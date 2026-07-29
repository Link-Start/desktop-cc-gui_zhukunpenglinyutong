/**
 * Shared V2 发送编排（Wave 4 / Change B）。
 *
 * 流程：begin_turn（Tx1 durable-first）→ attempt-owned Runtime dispatch
 * → Rust terminal owner commit（Tx2 幂等落账）→ frontend commit confirmation。
 *
 * 纪律：
 * - begin 返回 `recovery-required` / `target-unavailable` 时 fail closed：
 *   不发送、不改路由、不重试，直接把状态抛给调用方。
 * - 发送抛错在没有 typed negative ACK 时视为 ambiguous：进入 recovery-required，
 *   不伪造 explicit rejection，也不写 turnCommitted(failed)。
 * - Runtime dispatch 不接收重复 Target；Rust 只读取 durable attempt snapshot。
 * - terminal 内容由 Rust runtime lifecycle owner 持久化；frontend 通过 backend durable
 *   await 等待 exact Attempt commit，不以 UI event 作为控制终态。
 * - `endTurn` 在 finally 中兜底；只有 begin 早退（未 beginTurn）时不执行。
 *
 * V0 仅保留给显式 rollback；V2 不得调用 V0 actual-send。
 */

import {
  sharedSessionV2AwaitTurnTerminal,
  sharedSessionV2BeginTurn,
  sharedSessionV2DispatchTurn,
  sharedSessionV2MarkRecovery,
  sharedSessionV2PrepareContext,
  sharedSessionV2PrepareDelivery,
  type SharedV2ExecutionTargetPayload,
} from "../services/sharedSessions";
import { beginTurn, endTurn } from "../target/targetStore";
import {
  freezeTurnSnapshot,
  isResolvedExecutionTarget,
  type ExecutionTarget,
  type ProviderSelectionSource,
  type TurnExecutionSnapshot,
} from "../target/types";
import type {
  SharedSendEvent,
  SharedSendState,
} from "../target/sendStateMachine";
import type { SendSharedSessionTurnInput } from "./sendSharedSessionTurn";
import {
  consumeSharedSendAdmission,
  dispatchSharedSendEvent,
  getSharedSendState,
  setSharedSendActiveAttempt,
  tryAcquireSharedSend,
} from "./sharedSendStateStore";
import { registerSharedSessionNativeBinding } from "./sharedSessionBridge";

/** B.6：UI 状态机事件派发为 best-effort，状态驱动失败不得阻断发送链路。 */
function dispatchSendEvent(
  workspaceId: string,
  threadId: string,
  event: SharedSendEvent,
  options?: { detail?: string | null },
): void {
  try {
    dispatchSharedSendEvent(workspaceId, threadId, event, options);
  } catch {
    // 忽略：状态机仅驱动 UI，发送/落账语义不受影响。
  }
}

export type SharedV2ProviderMeta = {
  providerProfileNameSnapshot?: string | null;
  providerProfileSource?: ProviderSelectionSource | null;
  runtimeCapabilityFingerprint?: string | null;
};

export type SendSharedSessionTurnV2Input = SendSharedSessionTurnInput & {
  target: ExecutionTarget;
  providerMeta?: SharedV2ProviderMeta;
};

/** begin 早退：未发生任何发送，调用方据此进入 recovery / target-unavailable UI 态。 */
export type SharedV2SendEarlyReturn = {
  status: "cancelled" | "recovery-required" | "target-unavailable";
  bindingKey?: string;
  reason?: string;
};

/** non-idle admission 拒绝：不得创建 optimistic Turn 或触发任何 RPC。 */
export type SharedV2SendBlocked = {
  status: "blocked";
  state: SharedSendState;
  reason: "shared-send-not-idle" | "shared-send-admission-stale";
};

export type SharedV2SendCommitted = Record<string, unknown> & {
  status: "accepted";
  v2: {
    attemptId: string;
    logicalTurnId: string;
    bindingKey?: string;
    committed: true;
    duplicate: boolean;
  };
};

export type SendSharedSessionTurnV2Result =
  | SharedV2SendEarlyReturn
  | SharedV2SendBlocked
  | SharedV2SendCommitted;

/** 组装 Rust `ExecutionTargetInput`（reasoning 拍平为 reasoningEffort）。 */
function toTargetPayload(
  snapshot: TurnExecutionSnapshot,
): SharedV2ExecutionTargetPayload {
  return {
    engine: snapshot.engine,
    providerProfileId: snapshot.providerProfileId,
    modelCatalogEntryId: snapshot.modelCatalogEntryId,
    model: snapshot.model,
    reasoningEffort: snapshot.reasoning?.effort ?? null,
    providerProfileNameSnapshot: snapshot.providerProfileNameSnapshot,
    providerProfileSource: snapshot.providerProfileSource,
    runtimeCapabilityFingerprint: snapshot.runtimeCapabilityFingerprint,
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
}

function normalizeAckIdentity(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function isKnownFailedTerminalError(error: unknown): boolean {
  const message = toErrorMessage(error);
  return (
    !message.includes("canonical-failure-persistence:") &&
    (message.startsWith("context-prepare-failed:") ||
      message.startsWith("target-unavailable:") ||
      message.startsWith("target-provider-rejected:"))
  );
}

function isBindingRecoveryRequiredError(error: unknown): boolean {
  return toErrorMessage(error).startsWith("binding-recovery-required:");
}

export async function sendSharedSessionTurnV2(
  input: SendSharedSessionTurnV2Input,
): Promise<SendSharedSessionTurnV2Result> {
  if (!isResolvedExecutionTarget(input.target)) {
    throw new Error(
      "shared-v2-target-incomplete: 请先选择完整的 CLI、Provider 和 Model。",
    );
  }
  const sharedEngine = input.target.engine;
  const turnSnapshot = freezeTurnSnapshot(input.target, input.providerMeta);
  const targetPayload = toTargetPayload(turnSnapshot);

  const suppliedAdmissionRevision = input.sharedSendAdmissionRevision;
  if (suppliedAdmissionRevision !== undefined) {
    if (
      !Number.isSafeInteger(suppliedAdmissionRevision) ||
      suppliedAdmissionRevision <= 0 ||
      !consumeSharedSendAdmission(
        input.workspaceId,
        input.threadId,
        suppliedAdmissionRevision,
      )
    ) {
      return {
        status: "blocked",
        state: getSharedSendState(input.workspaceId, input.threadId).state,
        reason: "shared-send-admission-stale",
      };
    }
  } else {
    const admission = tryAcquireSharedSend(input.workspaceId, input.threadId);
    if (!admission.acquired) {
      return {
        status: "blocked",
        state: admission.state,
        reason: "shared-send-not-idle",
      };
    }
    if (
      !consumeSharedSendAdmission(
        input.workspaceId,
        input.threadId,
        admission.revision,
      )
    ) {
      return {
        status: "blocked",
        state: getSharedSendState(input.workspaceId, input.threadId).state,
        reason: "shared-send-admission-stale",
      };
    }
  }
  try {
    await sharedSessionV2PrepareContext(
      input.workspaceId,
      input.threadId,
      targetPayload,
    );
  } catch (prepareError) {
    // prepare_context 是只读操作，失败时没有 runtime/durable side effect，可安全回 idle。
    dispatchSendEvent(input.workspaceId, input.threadId, { type: "commitCancelled" });
    dispatchSendEvent(input.workspaceId, input.threadId, { type: "canonicalCommitted" });
    throw prepareError;
  }

  // Tx1：User Intent durable-first，先于任何 runtime side effect。
  let begin: Awaited<ReturnType<typeof sharedSessionV2BeginTurn>>;
  try {
    begin = await sharedSessionV2BeginTurn(
      input.workspaceId,
      input.threadId,
      targetPayload,
      input.text,
    );
  } catch (beginError) {
    // Tx1 RPC 失败无法证明 turnRequested 未落盘；禁止回 idle 后盲目重发。
    dispatchSendEvent(input.workspaceId, input.threadId, { type: "packagePrepared" });
    dispatchSendEvent(input.workspaceId, input.threadId, { type: "ackAmbiguous" });
    throw beginError;
  }
  if (begin.status !== "creating") {
    if (begin.status === "recovery-required") {
      // 状态机无 preparing-context → recovery-required 直达边：
      // 先推进到 awaiting-acceptance 再派发 ackAmbiguous，保证 UI 能落到 recovery-required。
      dispatchSendEvent(input.workspaceId, input.threadId, { type: "packagePrepared" });
      dispatchSendEvent(input.workspaceId, input.threadId, { type: "ackAmbiguous" });
    } else {
      dispatchSendEvent(input.workspaceId, input.threadId, { type: "targetUnavailable" }, {
        detail: begin.reason ?? null,
      });
    }
    return {
      status: begin.status,
      bindingKey: begin.bindingKey,
      reason: begin.reason,
    };
  }
  const attemptId = begin.attemptId?.trim();
  const logicalTurnId = begin.logicalTurnId?.trim();
  if (!attemptId || !logicalTurnId) {
    // 契约违例（creating 必须带 attempt/turn id）：fail closed，不进入发送段。
    dispatchSendEvent(input.workspaceId, input.threadId, { type: "packagePrepared" });
    dispatchSendEvent(input.workspaceId, input.threadId, { type: "ackAmbiguous" });
    throw new Error("shared_session_v2_begin_turn 契约违例：creating 缺少 attemptId/logicalTurnId");
  }
  setSharedSendActiveAttempt(input.workspaceId, input.threadId, attemptId);
  const markAttemptRecovery = async (reason: string) => {
    const recovery = await sharedSessionV2MarkRecovery(
      input.workspaceId,
      input.threadId,
      attemptId,
      reason,
    ).catch(() => undefined);
    if (recovery?.status === "terminal-committed") {
      dispatchSendEvent(input.workspaceId, input.threadId, {
        type: "probeTerminalRun",
      });
      dispatchSendEvent(input.workspaceId, input.threadId, {
        type: "canonicalCommitted",
      });
    }
    return recovery;
  };
  const confirmKnownFailedTerminal = async (recoveryReason: string) => {
    dispatchSendEvent(input.workspaceId, input.threadId, {
      type: "explicitRejection",
    });
    try {
      await sharedSessionV2AwaitTurnTerminal(
        input.workspaceId,
        input.threadId,
        attemptId,
      );
      dispatchSendEvent(input.workspaceId, input.threadId, {
        type: "canonicalCommitted",
      });
    } catch (commitError) {
      dispatchSendEvent(input.workspaceId, input.threadId, {
        type: "commitFailed",
      });
      await markAttemptRecovery(
        `${recoveryReason}: ${toErrorMessage(commitError)}`,
      );
    }
  };

  beginTurn(
    input.workspaceId,
    input.threadId,
    turnSnapshot,
    attemptId,
  );
  try {
    let preparedDelivery: Awaited<
      ReturnType<typeof sharedSessionV2PrepareDelivery>
    >;
    try {
      preparedDelivery = await sharedSessionV2PrepareDelivery(
        input.workspaceId,
        input.threadId,
        attemptId,
      );
    } catch (deliveryPrepareError) {
      // Tx1 已持久化；先进入 awaiting-acceptance，后续 terminal/recovery 迁移
      // 必须基于 durable Attempt，而不是停留在 preview 状态。
      dispatchSendEvent(input.workspaceId, input.threadId, {
        type: "packagePrepared",
      });
      if (isKnownFailedTerminalError(deliveryPrepareError)) {
        await confirmKnownFailedTerminal(
          "failed-context-terminal-commit-confirmation",
        );
        throw deliveryPrepareError;
      }
      dispatchSendEvent(input.workspaceId, input.threadId, { type: "ackAmbiguous" });
      await markAttemptRecovery(
        `context-prepare-failed: ${toErrorMessage(deliveryPrepareError)}`,
      );
      throw deliveryPrepareError;
    }

    // `degraded` 是可发送的 fidelity 诊断，不是人工审批 gate。完整 omission
    // manifest 已由 Rust durable-first 保存；Shared orchestration 继续 best-effort
    // dispatch，真实 prepare/ACK failure 仍走下方 fail-closed 分支。
    dispatchSendEvent(input.workspaceId, input.threadId, {
      type: "packagePrepared",
    });

    let response: Awaited<ReturnType<typeof sharedSessionV2DispatchTurn>>;
    try {
      response = await sharedSessionV2DispatchTurn(
        input.workspaceId,
        input.threadId,
        {
          attemptId,
          artifactId: preparedDelivery.artifactId,
          artifactChecksum: preparedDelivery.artifactChecksum,
          disableThinking: input.disableThinking,
          accessMode: input.accessMode,
          images: input.images,
          collaborationMode: input.collaborationMode,
          preferredLanguage: input.preferredLanguage,
          customSpecRoot: input.customSpecRoot,
        },
      );
    } catch (sendError) {
      if (isBindingRecoveryRequiredError(sendError)) {
        dispatchSendEvent(input.workspaceId, input.threadId, {
          type: "bindingRecoveryRequired",
        });
        setSharedSendActiveAttempt(input.workspaceId, input.threadId, null);
        return {
          status: "recovery-required",
          bindingKey: begin.bindingKey,
          reason: "native-session-not-found",
        };
      }
      if (isKnownFailedTerminalError(sendError)) {
        // Rust has authoritative negative evidence and commits a failed terminal
        // before returning this typed error. Confirm that commit and unlock the
        // linear Shared composer; do not misclassify a 4xx/model rejection as an
        // ambiguous transport failure.
        await confirmKnownFailedTerminal("failed-terminal-commit-confirmation");
        throw sendError;
      }
      // Transport failure may happen after Runtime accepted the prompt. Without a
      // typed negative ACK it is ambiguous and must not be retried blindly.
      dispatchSendEvent(input.workspaceId, input.threadId, { type: "ackAmbiguous" });
      await markAttemptRecovery(
        `runtime-delivery-ambiguous: ${toErrorMessage(sendError)}`,
      );
      throw sendError;
    }

    const nativeSessionId = response.nativeThreadId?.trim() ?? "";
    if (
      response.status !== "accepted" ||
      response.attemptId !== attemptId ||
      response.logicalTurnId !== logicalTurnId ||
      response.engine !== targetPayload.engine ||
      normalizeAckIdentity(response.providerProfileId) !==
        normalizeAckIdentity(targetPayload.providerProfileId) ||
      normalizeAckIdentity(response.model) !==
        normalizeAckIdentity(targetPayload.model) ||
      normalizeAckIdentity(response.reasoningEffort) !==
        normalizeAckIdentity(targetPayload.reasoningEffort) ||
      response.bindingKey !== begin.bindingKey ||
      response.delivery?.promptAcceptance !== "accepted" ||
      !nativeSessionId
    ) {
      dispatchSendEvent(input.workspaceId, input.threadId, { type: "ackAmbiguous" });
      await markAttemptRecovery("typed-prompt-ack-missing-or-mismatched");
      throw new Error("Shared runtime 未返回匹配 attempt/binding 的 typed prompt ACK");
    }

    registerSharedSessionNativeBinding({
      workspaceId: input.workspaceId,
      sharedThreadId: input.threadId,
      nativeThreadId: nativeSessionId,
      engine: sharedEngine,
      providerProfileId: response.providerProfileId ?? null,
      attemptId,
    });

    const contextAcceptance = response.delivery.contextAcceptance;
    if (
      contextAcceptance?.status !== "accepted" ||
      contextAcceptance.packageId !== preparedDelivery.packageId ||
      contextAcceptance.sourceChecksum !== preparedDelivery.sourceChecksum
    ) {
      dispatchSendEvent(input.workspaceId, input.threadId, { type: "ackAmbiguous" });
      await markAttemptRecovery("typed-context-ack-missing-or-mismatched");
      throw new Error("Shared runtime 未返回匹配 package/checksum 的 context ACK");
    }

    dispatchSendEvent(input.workspaceId, input.threadId, { type: "runtimeAck" });
    let commit;
    try {
      // Backend waiter 以 durable `conversation.turnCommitted` 为最终证据。
      // projected/inline terminal 继续用于展示，但不再拥有 Composer control flow。
      commit = await sharedSessionV2AwaitTurnTerminal(
        input.workspaceId,
        input.threadId,
        attemptId,
      );
    } catch (terminalError) {
      dispatchSendEvent(input.workspaceId, input.threadId, {
        type: "connectionLost",
      });
      await markAttemptRecovery(
        `terminal-await-failed: ${toErrorMessage(terminalError)}`,
      );
      throw terminalError;
    }
    dispatchSendEvent(input.workspaceId, input.threadId, { type: "runSettled" });

    if (commit.terminal.recoveryReason === "native-session-not-found") {
      dispatchSendEvent(input.workspaceId, input.threadId, {
        type: "bindingRecoveryRequired",
      });
      setSharedSendActiveAttempt(input.workspaceId, input.threadId, null);
      return {
        status: "recovery-required",
        bindingKey: commit.bindingKey ?? begin.bindingKey,
        reason: "native-session-not-found",
      };
    }

    dispatchSendEvent(input.workspaceId, input.threadId, { type: "canonicalCommitted" });

    return {
      ...response,
      v2: {
        attemptId,
        logicalTurnId,
        bindingKey: commit.bindingKey ?? begin.bindingKey,
        committed: true,
        duplicate: commit.duplicate === true,
      },
    };
  } finally {
    endTurn(input.workspaceId, input.threadId);
  }
}
