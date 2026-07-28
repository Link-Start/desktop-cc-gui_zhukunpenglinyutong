/**
 * Shared V2 发送编排（Wave 4 / Change B）。
 *
 * 流程：begin_turn（Tx1 durable-first）→ V0 链路实际发送 → commit_turn（Tx2 幂等落账）。
 *
 * 纪律：
 * - begin 返回 `recovery-required` / `target-unavailable` 时 fail closed：
 *   不发送、不改路由、不重试，直接把状态抛给调用方。
 * - 发送抛错在没有 typed negative ACK 时视为 ambiguous：进入 recovery-required，
 *   不伪造 explicit rejection，也不写 turnCommitted(failed)。
 * - 发送成功但 commit 失败才是真正的 ambiguous：mark_recovery(reason="commit-failed") 后抛出。
 * - `endTurn` 在 finally 中兜底；只有 begin 早退（未 beginTurn）时不执行。
 *
 * 发送段复用 V0 的 service + bridge 惯例（见 `sendSharedSessionTurn.ts`），
 * 并透传 `providerProfileId` 以归属到目标 Binding。
 */

import {
  sendSharedSessionMessage,
  setSharedSessionSelectedEngine,
  sharedSessionV2AcceptTurn,
  sharedSessionV2AcceptContext,
  sharedSessionV2BeginTurn,
  sharedSessionV2CommitTurn,
  sharedSessionV2MarkRecovery,
  sharedSessionV2PrepareContext,
  sharedSessionV2PrepareDelivery,
  type SharedSessionRuntimeDelivery,
  type SharedV2ExecutionTargetPayload,
} from "../services/sharedSessions";
import { beginTurn, endTurn } from "../target/targetStore";
import { freezeTurnSnapshot, type ExecutionTarget } from "../target/types";
import type { SharedSendEvent } from "../target/sendStateMachine";
import type { SendSharedSessionTurnInput } from "./sendSharedSessionTurn";
import {
  dispatchSharedSendEvent,
  waitForSharedDegradedContextDecision,
} from "./sharedSendStateStore";
import {
  registerSharedSessionNativeBinding,
  rebindSharedSessionNativeThread,
} from "./sharedSessionBridge";
import { captureSharedRuntimeTerminal } from "./sharedRuntimeTerminal";

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
  providerProfileSource?: string | null;
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

export type SharedV2SendCommitted = Record<string, unknown> & {
  v2: {
    attemptId: string;
    logicalTurnId: string;
    bindingKey?: string;
    committed: true;
    duplicate: boolean;
  };
};

export type SendSharedSessionTurnV2Result = SharedV2SendEarlyReturn | SharedV2SendCommitted;

/** 组装 Rust `ExecutionTargetInput`（reasoning 拍平为 reasoningEffort）。 */
function toTargetPayload(
  target: ExecutionTarget,
  providerMeta?: SharedV2ProviderMeta,
): SharedV2ExecutionTargetPayload {
  return {
    engine: target.engine,
    providerProfileId: target.providerProfileId ?? null,
    model: target.model ?? null,
    reasoningEffort: target.reasoning?.effort ?? null,
    providerProfileNameSnapshot: providerMeta?.providerProfileNameSnapshot ?? null,
    providerProfileSource: providerMeta?.providerProfileSource ?? null,
    runtimeCapabilityFingerprint: providerMeta?.runtimeCapabilityFingerprint ?? null,
  };
}

/** 尽力从 V0 响应里提取 assistant 文本；拿不到就返回 null（不阻塞 commit）。 */
function extractAssistantText(
  response: Record<string, unknown> | null | undefined,
): string | null {
  if (!response) {
    return null;
  }
  const direct = response.assistantText;
  if (typeof direct === "string" && direct.trim()) {
    return direct;
  }
  const result = response.result;
  if (result && typeof result === "object") {
    const text = (result as Record<string, unknown>).text;
    if (typeof text === "string" && text.trim()) {
      return text;
    }
  }
  return null;
}

function extractRuntimeTurnId(
  response: Record<string, unknown> | null | undefined,
): string | null {
  if (!response) {
    return null;
  }
  const turn =
    response.turn && typeof response.turn === "object"
      ? (response.turn as Record<string, unknown>)
      : null;
  const result =
    response.result && typeof response.result === "object"
      ? (response.result as Record<string, unknown>)
      : null;
  const nestedTurn =
    result?.turn && typeof result.turn === "object"
      ? (result.turn as Record<string, unknown>)
      : null;
  const value = turn?.id ?? nestedTurn?.id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
}

/**
 * V0 发送段：与 `sendSharedSessionTurn` 同构，额外透传 providerProfileId。
 * 返回原始 V0 响应。
 */
async function sendTurnViaV0(
  input: SendSharedSessionTurnV2Input,
  outboundText = input.text,
  contextDelivery?: {
    packageId: string;
    sourceChecksum: string;
    operation: "context-import" | "prompt-prefix";
    importItems: Record<string, unknown>[];
    ackFidelity: "strong" | "weak" | "unsupported";
  },
) {
  const providerProfileId = input.target.providerProfileId ?? null;
  const selection = await setSharedSessionSelectedEngine(
    input.workspaceId,
    input.threadId,
    input.engine,
    providerProfileId,
  );
  const selectedNativeThreadId =
    typeof selection?.nativeThreadId === "string" ? selection.nativeThreadId.trim() : "";
  if (selectedNativeThreadId) {
    registerSharedSessionNativeBinding({
      workspaceId: input.workspaceId,
      sharedThreadId: input.threadId,
      nativeThreadId: selectedNativeThreadId,
      engine: input.engine,
      providerProfileId,
    });
  }
  const response = await sendSharedSessionMessage(
    input.workspaceId,
    input.threadId,
    input.engine,
    outboundText,
    {
      model: input.model,
      effort: input.effort,
      disableThinking: input.disableThinking,
      collaborationMode: input.collaborationMode,
      accessMode: input.accessMode,
      images: input.images,
      preferredLanguage: input.preferredLanguage,
      customSpecRoot: input.customSpecRoot,
      providerProfileId,
      contextDelivery: contextDelivery ?? null,
    },
  );
  const nativeThreadId =
    typeof response?.nativeThreadId === "string" ? response.nativeThreadId.trim() : "";
  if (nativeThreadId) {
    const shouldRebindSelectedThread =
      selectedNativeThreadId &&
      selectedNativeThreadId !== nativeThreadId &&
      selectedNativeThreadId.startsWith(`${input.engine}-pending-shared-`);
    if (shouldRebindSelectedThread) {
      const rebound = rebindSharedSessionNativeThread({
        workspaceId: input.workspaceId,
        oldNativeThreadId: selectedNativeThreadId,
        newNativeThreadId: nativeThreadId,
      });
      if (!rebound) {
        registerSharedSessionNativeBinding({
          workspaceId: input.workspaceId,
          sharedThreadId: input.threadId,
          nativeThreadId,
          engine: input.engine,
          providerProfileId,
        });
      }
    } else {
      registerSharedSessionNativeBinding({
        workspaceId: input.workspaceId,
        sharedThreadId: input.threadId,
        nativeThreadId,
        engine: input.engine,
        providerProfileId,
      });
    }
  }
  return response;
}

export async function sendSharedSessionTurnV2(
  input: SendSharedSessionTurnV2Input,
): Promise<SendSharedSessionTurnV2Result> {
  const targetPayload = toTargetPayload(input.target, input.providerMeta);

  // B.6：进入发送流程（idle → preparing-context；非 idle 时迁移被状态机忽略）。
  dispatchSendEvent(input.workspaceId, input.threadId, { type: "send" });
  let preparedContext: Awaited<
    ReturnType<typeof sharedSessionV2PrepareContext>
  >;
  try {
    preparedContext = await sharedSessionV2PrepareContext(
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
  if (preparedContext.status === "degraded") {
    dispatchSharedSendEvent(
      input.workspaceId,
      input.threadId,
      { type: "lossyProjection" },
      {
        degradedInfo: {
          mode: preparedContext.mode,
          omissions: preparedContext.omissions,
          dispositions: preparedContext.manifest?.omitted.map(
            (omission) => omission.disposition,
          ),
          sourceEstimatedTokens:
            preparedContext.compression?.sourceEstimatedTokens,
          packageEstimatedTokens:
            preparedContext.compression?.packageEstimatedTokens,
          reason: preparedContext.omissions.join("; "),
        },
      },
    );
    const confirmed = await waitForSharedDegradedContextDecision(
      input.workspaceId,
      input.threadId,
    );
    if (!confirmed) {
      dispatchSendEvent(input.workspaceId, input.threadId, { type: "commitCancelled" });
      dispatchSendEvent(input.workspaceId, input.threadId, { type: "canonicalCommitted" });
      return { status: "cancelled" };
    }
    dispatchSendEvent(input.workspaceId, input.threadId, { type: "degradedConfirmed" });
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
    await sharedSessionV2MarkRecovery(input.workspaceId, input.threadId, {
      bindingKey: begin.bindingKey ?? "",
      engine: input.target.engine,
      providerProfileId: input.target.providerProfileId ?? null,
      reason: "begin-turn-contract-violation",
    }).catch(() => undefined);
    throw new Error("shared_session_v2_begin_turn 契约违例：creating 缺少 attemptId/logicalTurnId");
  }

  // begin 落账成功（preparing-context → awaiting-acceptance）。
  dispatchSendEvent(input.workspaceId, input.threadId, { type: "packagePrepared" });

  beginTurn(
    input.workspaceId,
    input.threadId,
    freezeTurnSnapshot(input.target, input.providerMeta),
  );
  const runtimeTerminalCapture =
    captureSharedRuntimeTerminal(input.workspaceId);
  try {
    let preparedDelivery: Awaited<
      ReturnType<typeof sharedSessionV2PrepareDelivery>
    >;
    try {
      preparedDelivery = await sharedSessionV2PrepareDelivery(
        input.workspaceId,
        input.threadId,
        {
          attemptId,
          logicalTurnId,
          target: targetPayload,
        },
      );
    } catch (deliveryPrepareError) {
      dispatchSendEvent(input.workspaceId, input.threadId, { type: "ackAmbiguous" });
      await sharedSessionV2MarkRecovery(input.workspaceId, input.threadId, {
        bindingKey: begin.bindingKey ?? "",
        engine: input.target.engine,
        providerProfileId: input.target.providerProfileId ?? null,
        reason: `context-prepare-failed: ${toErrorMessage(deliveryPrepareError)}`,
      }).catch(() => undefined);
      throw deliveryPrepareError;
    }

    let response: SharedSessionRuntimeDelivery | null | undefined;
    try {
      const outboundText = preparedDelivery.promptPrefix
        ? `${preparedDelivery.promptPrefix}\n\n${input.text}`
        : input.text;
      response = await sendTurnViaV0(input, outboundText, {
        packageId: preparedDelivery.packageId,
        sourceChecksum: preparedDelivery.sourceChecksum,
        operation: preparedDelivery.operation,
        importItems: preparedDelivery.importItems,
        ackFidelity: preparedDelivery.ackFidelity,
      });
    } catch (sendError) {
      // 旧 RPC 的 Err(String) 无法证明 prompt 未被 runtime 接收。timeout、
      // disconnect、process exit 都可能发生在 side effect 之后，必须 fail closed。
      dispatchSendEvent(input.workspaceId, input.threadId, { type: "ackAmbiguous" });
      await sharedSessionV2MarkRecovery(input.workspaceId, input.threadId, {
        bindingKey: begin.bindingKey ?? "",
        engine: input.target.engine,
        providerProfileId: input.target.providerProfileId ?? null,
        reason: `runtime-delivery-ambiguous: ${toErrorMessage(sendError)}`,
      }).catch(() => undefined);
      throw sendError;
    }

    const nativeSessionId =
      typeof response?.nativeThreadId === "string"
        ? response.nativeThreadId.trim()
        : "";
    if (
      response?.delivery?.promptAcceptance !== "accepted" ||
      !nativeSessionId
    ) {
      dispatchSendEvent(input.workspaceId, input.threadId, { type: "ackAmbiguous" });
      await sharedSessionV2MarkRecovery(input.workspaceId, input.threadId, {
        bindingKey: begin.bindingKey ?? "",
        engine: input.target.engine,
        providerProfileId: input.target.providerProfileId ?? null,
        reason: "typed-prompt-ack-missing",
      }).catch(() => undefined);
      throw new Error("Shared runtime 未返回 typed prompt ACK");
    }
    let contextAcceptance = response.delivery.contextAcceptance;
    if (
      preparedDelivery.ackFidelity === "strong" &&
      contextAcceptance?.status === "pending"
    ) {
      try {
        await runtimeTerminalCapture.waitForContext({
          packageId: preparedDelivery.packageId,
          sourceChecksum: preparedDelivery.sourceChecksum,
        });
      } catch (contextAckError) {
        dispatchSendEvent(input.workspaceId, input.threadId, { type: "ackAmbiguous" });
        await sharedSessionV2MarkRecovery(input.workspaceId, input.threadId, {
          bindingKey: begin.bindingKey ?? "",
          engine: input.target.engine,
          providerProfileId: input.target.providerProfileId ?? null,
          reason: `context-ack-missing: ${toErrorMessage(contextAckError)}`,
        }).catch(() => undefined);
        throw contextAckError;
      }
      contextAcceptance = {
        status: "accepted",
        packageId: preparedDelivery.packageId,
        sourceChecksum: preparedDelivery.sourceChecksum,
        ackFidelity: "strong",
        evidence: "claude-replay-user-message-checksum-echo",
      };
    }
    if (
      contextAcceptance?.status !== "accepted" ||
      contextAcceptance.packageId !== preparedDelivery.packageId ||
      contextAcceptance.sourceChecksum !== preparedDelivery.sourceChecksum
    ) {
      dispatchSendEvent(input.workspaceId, input.threadId, { type: "ackAmbiguous" });
      await sharedSessionV2MarkRecovery(input.workspaceId, input.threadId, {
        bindingKey: begin.bindingKey ?? "",
        engine: input.target.engine,
        providerProfileId: input.target.providerProfileId ?? null,
        reason: "typed-context-ack-missing-or-mismatched",
      }).catch(() => undefined);
      throw new Error("Shared runtime 未返回匹配 package/checksum 的 context ACK");
    }

    await sharedSessionV2AcceptContext(input.workspaceId, input.threadId, {
      attemptId,
      logicalTurnId,
      bindingKey: begin.bindingKey ?? "",
      packageId: preparedDelivery.packageId,
      nativeSessionId,
      nativeRequestId: extractRuntimeTurnId(response),
    });
    await sharedSessionV2AcceptTurn(input.workspaceId, input.threadId, {
      attemptId,
      logicalTurnId,
      target: targetPayload,
      nativeSessionId,
    });
    dispatchSendEvent(input.workspaceId, input.threadId, { type: "runtimeAck" });
    let terminal;
    try {
      terminal =
        response.delivery.terminal?.type === "run.settled"
          ? { ...response.delivery.terminal, assistantText: null }
          : await runtimeTerminalCapture?.waitFor({
              nativeThreadId: nativeSessionId,
              runtimeTurnId: extractRuntimeTurnId(response),
            });
      if (!terminal) {
        throw new Error("Shared runtime 未返回 typed run.settled");
      }
    } catch (terminalError) {
      dispatchSendEvent(input.workspaceId, input.threadId, { type: "ackAmbiguous" });
      await sharedSessionV2MarkRecovery(input.workspaceId, input.threadId, {
        bindingKey: begin.bindingKey ?? "",
        engine: input.target.engine,
        providerProfileId: input.target.providerProfileId ?? null,
        reason: "run-settled-missing",
      }).catch(() => undefined);
      throw terminalError;
    }
    dispatchSendEvent(input.workspaceId, input.threadId, { type: "runSettled" });

    let commit;
    try {
      commit = await sharedSessionV2CommitTurn(input.workspaceId, input.threadId, {
        attemptId,
        logicalTurnId,
        target: targetPayload,
        assistantText: terminal.assistantText ?? extractAssistantText(response),
        outcome: { status: terminal.outcome },
        nativeSessionId,
      });
    } catch (commitError) {
      // 发送已成功但 commit 失败 = ambiguous ACK：禁止盲目重建，标记 recovery 后抛出。
      dispatchSendEvent(input.workspaceId, input.threadId, { type: "commitFailed" });
      await sharedSessionV2MarkRecovery(input.workspaceId, input.threadId, {
        bindingKey: begin.bindingKey ?? "",
        engine: input.target.engine,
        providerProfileId: input.target.providerProfileId ?? null,
        reason: "commit-failed",
      }).catch(() => undefined);
      throw commitError;
    }

    // commit 落账成功（settling → idle）。
    dispatchSendEvent(input.workspaceId, input.threadId, { type: "canonicalCommitted" });

    return {
      ...(response ?? {}),
      v2: {
        attemptId,
        logicalTurnId,
        bindingKey: commit.bindingKey ?? begin.bindingKey,
        committed: true,
        duplicate: commit.duplicate === true,
      },
    };
  } finally {
    runtimeTerminalCapture?.dispose();
    endTurn(input.workspaceId, input.threadId);
  }
}
