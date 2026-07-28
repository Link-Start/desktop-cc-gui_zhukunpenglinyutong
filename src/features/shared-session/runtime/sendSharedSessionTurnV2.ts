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
  sharedSessionV2BeginTurn,
  sharedSessionV2CommitTurn,
  sharedSessionV2MarkRecovery,
  type SharedV2ExecutionTargetPayload,
} from "../services/sharedSessions";
import { beginTurn, endTurn } from "../target/targetStore";
import { freezeTurnSnapshot, type ExecutionTarget } from "../target/types";
import type { SharedSendEvent } from "../target/sendStateMachine";
import type { SendSharedSessionTurnInput } from "./sendSharedSessionTurn";
import { dispatchSharedSendEvent } from "./sharedSendStateStore";
import {
  registerSharedSessionNativeBinding,
  rebindSharedSessionNativeThread,
} from "./sharedSessionBridge";

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
  status: "recovery-required" | "target-unavailable";
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
async function sendTurnViaV0(input: SendSharedSessionTurnV2Input) {
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
    input.text,
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

  // Tx1：User Intent durable-first，先于任何 runtime side effect。
  const begin = await sharedSessionV2BeginTurn(
    input.workspaceId,
    input.threadId,
    targetPayload,
    input.text,
  );
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
    throw new Error("shared_session_v2_begin_turn 契约违例：creating 缺少 attemptId/logicalTurnId");
  }

  // begin 落账成功（preparing-context → awaiting-acceptance）。
  dispatchSendEvent(input.workspaceId, input.threadId, { type: "packagePrepared" });

  beginTurn(
    input.workspaceId,
    input.threadId,
    freezeTurnSnapshot(input.target, input.providerMeta),
  );
  try {
    let response: Record<string, unknown> | null | undefined;
    try {
      response = await sendTurnViaV0(input);
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

    // V0 RPC 返回 = runtime ACK + run settled 同时成立（阻塞式发送）。
    dispatchSendEvent(input.workspaceId, input.threadId, { type: "runtimeAck" });
    dispatchSendEvent(input.workspaceId, input.threadId, { type: "runSettled" });

    let commit;
    try {
      commit = await sharedSessionV2CommitTurn(input.workspaceId, input.threadId, {
        attemptId,
        logicalTurnId,
        target: targetPayload,
        assistantText: extractAssistantText(response),
        outcome: { status: "completed" },
        nativeSessionId:
          typeof response?.nativeThreadId === "string" ? response.nativeThreadId : null,
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
    endTurn(input.workspaceId, input.threadId);
  }
}
