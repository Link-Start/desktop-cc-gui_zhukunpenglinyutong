export type ThreadDeleteErrorCode =
  | "WORKSPACE_NOT_CONNECTED"
  | "SESSION_NOT_FOUND"
  | "PERMISSION_DENIED"
  | "IO_ERROR"
  | "ENGINE_UNSUPPORTED"
  | "UNKNOWN";

const GHOST_INDEX_DELETE_CODES = new Set([
  "OWNER_WORKSPACE_UNRESOLVED",
  "SESSION_NOT_IN_WORKSPACE_SCOPE",
]);

export function isGhostClientSessionIndexDeleteError(
  errorMessage: string | null | undefined,
  code?: string | null,
): boolean {
  const normalizedCode = (code ?? "").trim().toUpperCase();
  if (GHOST_INDEX_DELETE_CODES.has(normalizedCode)) {
    return true;
  }
  const normalized = (errorMessage ?? "").trim().toLowerCase();
  return (
    normalized.includes("session does not belong to target workspace") ||
    normalized.includes("codex session target could not be resolved safely")
  );
}

export function sessionIndexIdsForThreadTombstone(threadId: string): string[] {
  const trimmed = threadId.trim();
  // 只传原始 threadId。后端对 `claude:xxx` 会拆 engine 并只标该 engine；
  // 再传裸 id 会走「全 engine 占位」分支，误伤同 id 的其他 CLI 行。
  return trimmed ? [trimmed] : [];
}

export function mapDeleteErrorCode(errorMessage: string): ThreadDeleteErrorCode {
  const normalized = errorMessage.toLowerCase();
  if (normalized.includes("[engine_unsupported]")) {
    return "ENGINE_UNSUPPORTED";
  }
  if (
    normalized.includes("[workspace_not_connected]") ||
    normalized.includes("workspace not connected") ||
    normalized.includes("workspace not found")
  ) {
    return "WORKSPACE_NOT_CONNECTED";
  }
  if (
    normalized.includes("[session_not_found]") ||
    normalized.includes("session file not found") ||
    normalized.includes("not found") ||
    normalized.includes("thread not found")
  ) {
    return "SESSION_NOT_FOUND";
  }
  if (normalized.includes("[io_error]")) {
    return "IO_ERROR";
  }
  if (normalized.includes("permission denied")) {
    return "PERMISSION_DENIED";
  }
  if (normalized.includes("io") || normalized.includes("failed to delete session file")) {
    return "IO_ERROR";
  }
  if (normalized.includes("unsupported")) {
    return "ENGINE_UNSUPPORTED";
  }
  return "UNKNOWN";
}

export function shouldSettleDeleteAsSuccess(
  errorMessage: string,
  code?: string | null,
): boolean {
  if (isGhostClientSessionIndexDeleteError(errorMessage, code)) {
    return true;
  }
  const normalized = errorMessage.trim().toLowerCase();
  if (
    normalized.includes("invalid claude session id") ||
    normalized.includes("invalid gemini session id") ||
    normalized.includes("invalid opencode session id")
  ) {
    return false;
  }
  return (
    normalized.includes("session file not found") ||
    normalized.includes("session not found") ||
    normalized.includes("thread not found")
  );
}
