function normalizeThreadId(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export function isClaudeThreadId(threadId: string | null | undefined) {
  const normalizedThreadId = normalizeThreadId(threadId).toLowerCase();
  return (
    normalizedThreadId.startsWith("claude:") ||
    normalizedThreadId.startsWith("claude-pending-")
  );
}

export function shouldShowHistoryLoadingForSelectionThread(
  threadId: string | null | undefined,
) {
  const normalizedThreadId = normalizeThreadId(threadId).toLowerCase();
  if (!normalizedThreadId || normalizedThreadId.includes("-pending-")) {
    return false;
  }
  // Shared 与 Native（含 DSH `loadDshSession`）都需要画布 loading，避免空态闪烁。
  // gemini/opencode 历史链路较轻，仍保持原排除策略。
  // Native / DSH 选中时写 Native prepare progress，不再只开布尔幕布。
  return (
    !normalizedThreadId.startsWith("gemini:") &&
    !normalizedThreadId.startsWith("opencode:")
  );
}

type ResolveClaudeContinuationThreadIdInput = {
  workspaceId: string;
  threadId: string | null | undefined;
  turnId?: string | null;
  resolveCanonicalThreadId: (threadId: string) => string;
  resolvePendingThreadForSession?: (
    workspaceId: string,
    engine: "claude" | "gemini" | "grok" | "kimi" | "opencode" | "dsh",
  ) => string | null;
  getActiveTurnIdForThread?: (threadId: string) => string | null;
};

export function resolveClaudeContinuationThreadId({
  workspaceId,
  threadId,
  turnId,
  resolveCanonicalThreadId,
  resolvePendingThreadForSession,
  getActiveTurnIdForThread,
}: ResolveClaudeContinuationThreadIdInput): string | null {
  const normalizedThreadId = normalizeThreadId(threadId);
  if (!normalizedThreadId) {
    return null;
  }

  const canonicalThreadId = resolveCanonicalThreadId(normalizedThreadId);
  if (!isClaudeThreadId(canonicalThreadId)) {
    return canonicalThreadId;
  }
  if (canonicalThreadId !== normalizedThreadId) {
    return canonicalThreadId;
  }

  const normalizedTurnId = normalizeThreadId(turnId);
  if (!normalizedTurnId || !getActiveTurnIdForThread) {
    return canonicalThreadId;
  }

  const pendingThreadId =
    resolvePendingThreadForSession?.(workspaceId, "claude") ?? null;
  if (!pendingThreadId || !isClaudeThreadId(pendingThreadId)) {
    return canonicalThreadId;
  }

  const pendingCanonicalThreadId = resolveCanonicalThreadId(pendingThreadId);
  const pendingTurnId =
    getActiveTurnIdForThread(pendingCanonicalThreadId) ??
    getActiveTurnIdForThread(pendingThreadId);
  if ((pendingTurnId ?? "").trim() !== normalizedTurnId) {
    return canonicalThreadId;
  }

  return pendingCanonicalThreadId;
}
