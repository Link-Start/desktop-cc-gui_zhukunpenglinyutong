export function isRewindSupportedThreadId(threadId: string): boolean {
  const normalized = threadId.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (normalized.startsWith("claude:") || normalized.startsWith("codex:")) {
    return true;
  }
  if (
    normalized.startsWith("claude-pending-") ||
    normalized.startsWith("codex-pending-") ||
    normalized.startsWith("gemini:") ||
    normalized.startsWith("gemini-pending-") ||
    normalized.startsWith("grok:") ||
    normalized.startsWith("grok-pending-") ||
    normalized.startsWith("kimi:") ||
    normalized.startsWith("kimi-pending-") ||
    normalized.startsWith("opencode:") ||
    normalized.startsWith("opencode-pending-") ||
    normalized.startsWith("dsh:") ||
    normalized.startsWith("dsh-pending-")
  ) {
    return false;
  }
  if (normalized.includes(":")) {
    return false;
  }
  return true;
}
