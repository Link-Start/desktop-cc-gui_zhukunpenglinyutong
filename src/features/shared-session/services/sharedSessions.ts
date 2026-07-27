import { invoke } from "@tauri-apps/api/core";
import type { EngineType } from "../../../types";
import type {
  SharedProjectionItem,
  SharedProjectionMismatchReport,
} from "../../messages/presentation/sharedProjection/types";
import { normalizeSharedSessionEngine } from "../utils/sharedSessionEngines";

export async function startSharedSession(
  workspaceId: string,
  selectedEngine?: EngineType | null,
) {
  return invoke<Record<string, unknown> | null | undefined>("start_shared_session", {
    workspaceId,
    selectedEngine: normalizeSharedSessionEngine(selectedEngine),
  });
}

export async function sendSharedSessionMessage(
  workspaceId: string,
  threadId: string,
  engine: EngineType,
  text: string,
  options?: {
    model?: string | null;
    effort?: string | null;
    disableThinking?: boolean | null;
    accessMode?: "default" | "read-only" | "current" | "full-access";
    images?: string[];
    collaborationMode?: Record<string, unknown> | null;
    preferredLanguage?: string | null;
    customSpecRoot?: string | null;
    /** Wave 4 / Change B：Provider Profile 归属；缺省为 null（旧 V0 行为，default/local 语义）。 */
    providerProfileId?: string | null;
  },
) {
  return invoke<Record<string, unknown> | null | undefined>("send_shared_session_message", {
    workspaceId,
    threadId,
    engine,
    text,
    model: options?.model ?? null,
    effort: options?.effort ?? null,
    disableThinking: options?.disableThinking ?? false,
    accessMode: options?.accessMode ?? null,
    images: options?.images ?? null,
    preferredLanguage: options?.preferredLanguage ?? null,
    collaborationMode: options?.collaborationMode ?? null,
    customSpecRoot: options?.customSpecRoot ?? null,
    providerProfileId: options?.providerProfileId ?? null,
  });
}

export async function listSharedSessions(workspaceId: string) {
  return invoke<Record<string, unknown>[]>("list_shared_sessions", {
    workspaceId,
  });
}

export async function loadSharedSession(workspaceId: string, threadId: string) {
  return invoke<Record<string, unknown> | null>("load_shared_session", {
    workspaceId,
    threadId,
  });
}

export async function loadSharedProjection(workspaceId: string, threadId: string) {
  return invoke<SharedProjectionItem[]>("load_shared_projection", {
    workspaceId,
    threadId,
  });
}

export async function rebuildSharedProjection(workspaceId: string, threadId: string) {
  return invoke<SharedProjectionItem[]>("rebuild_shared_projection", {
    workspaceId,
    threadId,
  });
}

export async function compareSharedProjection(workspaceId: string, threadId: string) {
  return invoke<SharedProjectionMismatchReport>("compare_shared_projection", {
    workspaceId,
    threadId,
  });
}

export async function setSharedSessionSelectedEngine(
  workspaceId: string,
  threadId: string,
  selectedEngine: EngineType,
  providerProfileId?: string | null,
) {
  return invoke<Record<string, unknown> | null>("set_shared_session_selected_engine", {
    workspaceId,
    threadId,
    selectedEngine: normalizeSharedSessionEngine(selectedEngine),
    providerProfileId: providerProfileId ?? null,
  });
}

export async function updateSharedSessionNativeBinding(
  workspaceId: string,
  threadId: string,
  engine: EngineType,
  oldNativeThreadId: string | null,
  newNativeThreadId: string,
  /** Wave 4 / B.5：managed Provider 时透传，缺省为 null（旧 V0 行为，写 engine 级 binding）。 */
  providerProfileId?: string | null,
) {
  return invoke<Record<string, unknown> | null>("update_shared_session_native_binding", {
    workspaceId,
    threadId,
    engine,
    oldNativeThreadId,
    newNativeThreadId,
    providerProfileId: providerProfileId ?? null,
  });
}

export async function syncSharedSessionSnapshot(
  workspaceId: string,
  threadId: string,
  items: unknown[],
  selectedEngine: EngineType,
) {
  return invoke<Record<string, unknown> | null>("sync_shared_session_snapshot", {
    workspaceId,
    threadId,
    items,
    selectedEngine: normalizeSharedSessionEngine(selectedEngine),
  });
}

export async function deleteSharedSession(
  workspaceId: string,
  threadId: string,
) {
  return invoke<Record<string, unknown> | null>("delete_shared_session", {
    workspaceId,
    threadId,
  });
}

// ---------------------------------------------------------------------------
// Wave 4 / Change B：Shared V2 发送链路（durable-first begin/commit/recovery）。
// 与 Rust `shared_session_v2.rs` 的 Tauri command 一一对应；参数全部 camelCase。
// ---------------------------------------------------------------------------

/** `shared_session_v2_begin_turn` / `commit_turn` 的 target 入参（对齐 `ExecutionTargetInput`）。 */
export type SharedV2ExecutionTargetPayload = {
  engine: EngineType;
  providerProfileId?: string | null;
  model?: string | null;
  reasoningEffort?: string | null;
  providerProfileNameSnapshot?: string | null;
  providerProfileSource?: string | null;
  runtimeCapabilityFingerprint?: string | null;
};

export type SharedV2BeginTurnResult = {
  status: "creating" | "recovery-required" | "target-unavailable";
  attemptId?: string;
  logicalTurnId?: string;
  bindingKey?: string;
  snapshot?: Record<string, unknown>;
  reason?: string;
};

export type SharedV2CommitOutcome = {
  status: "completed" | "failed" | "cancelled";
  errorCode?: string | null;
  errorMessage?: string | null;
  stopReason?: string | null;
};

export type SharedV2CommitTurnResult = {
  status: "committed";
  duplicate: boolean;
  sequence?: number | null;
  bindingKey: string;
};

export type SharedV2MarkRecoveryResult = {
  status: "recovery-required";
  bindingKey: string;
};

export type SharedV2RebuildBindingResult = {
  status: "prepared";
  bindingKey: string;
  nativeThreadId: string;
  archivedNativeSessionId?: string | null;
};

export type SharedV2InFlightAttempt = {
  attemptId: string;
  logicalTurnId?: string | null;
};

export type SharedV2ProbeBindingResult = {
  status: "ok";
  provisioningState?: string | null;
  nativeSessionId?: string | null;
  committedThroughSequence?: number | null;
  inFlightAttempts: (SharedV2InFlightAttempt & { accepted: boolean })[];
};

export type SharedV2TurnStateResult = {
  status: "ok";
  inFlightAttempts: SharedV2InFlightAttempt[];
  bindings: {
    bindingKey: string;
    provisioningState: string;
    availability: string;
  }[];
};

export async function sharedSessionV2BeginTurn(
  workspaceId: string,
  threadId: string,
  target: SharedV2ExecutionTargetPayload,
  text: string,
) {
  return invoke<SharedV2BeginTurnResult>("shared_session_v2_begin_turn", {
    workspaceId,
    threadId,
    target,
    text,
  });
}

export async function sharedSessionV2CommitTurn(
  workspaceId: string,
  threadId: string,
  params: {
    attemptId: string;
    logicalTurnId: string;
    target: SharedV2ExecutionTargetPayload;
    assistantText?: string | null;
    outcome: SharedV2CommitOutcome;
    nativeSessionId?: string | null;
  },
) {
  return invoke<SharedV2CommitTurnResult>("shared_session_v2_commit_turn", {
    workspaceId,
    threadId,
    attemptId: params.attemptId,
    logicalTurnId: params.logicalTurnId,
    target: params.target,
    assistantText: params.assistantText ?? null,
    outcome: params.outcome,
    nativeSessionId: params.nativeSessionId ?? null,
  });
}

export async function sharedSessionV2MarkRecovery(
  workspaceId: string,
  threadId: string,
  params: {
    bindingKey: string;
    engine: EngineType;
    providerProfileId?: string | null;
    reason?: string | null;
  },
) {
  return invoke<SharedV2MarkRecoveryResult>("shared_session_v2_mark_recovery", {
    workspaceId,
    threadId,
    bindingKey: params.bindingKey,
    engine: params.engine,
    providerProfileId: params.providerProfileId ?? null,
    reason: params.reason ?? null,
  });
}

export async function sharedSessionV2RebuildBinding(
  workspaceId: string,
  threadId: string,
  params: {
    bindingKey: string;
    engine: EngineType;
    providerProfileId?: string | null;
  },
) {
  return invoke<SharedV2RebuildBindingResult>("shared_session_v2_rebuild_binding", {
    workspaceId,
    threadId,
    bindingKey: params.bindingKey,
    engine: params.engine,
    providerProfileId: params.providerProfileId ?? null,
  });
}

export async function sharedSessionV2ProbeBinding(
  workspaceId: string,
  threadId: string,
  bindingKey: string,
) {
  return invoke<SharedV2ProbeBindingResult>("shared_session_v2_probe_binding", {
    workspaceId,
    threadId,
    bindingKey,
  });
}

export async function sharedSessionV2TurnState(workspaceId: string, threadId: string) {
  return invoke<SharedV2TurnStateResult>("shared_session_v2_turn_state", {
    workspaceId,
    threadId,
  });
}
