const CODEX_BACKGROUND_HELPER_PROMPT_PREFIXES = [
  "Generate a concise title for a coding chat thread from the first user message.",
  "You create concise run metadata for a coding task.",
  "You are generating OpenSpec project context.",
  "## Memory Writing Agent: Phase 2",
  "Memory Writing Agent: Phase 2",
] as const;

// Git commit-message helpers can be spawned by any engine (Grok / Claude / Codex).
// Native lists often drop autoSession metadata, so the sidebar uses this cheap
// startsWith check instead of a second scan.
const COMMIT_MESSAGE_HELPER_PROMPT_PREFIXES = [
  "Please generate a commit message.",
  "请生成一次提交（commit）信息",
  "Generate a concise git commit message for the following changes.",
] as const;

function hasMemoryWritingAgentSignature(text: string): boolean {
  const lower = text.toLowerCase();
  const startsWithMemoryAgentHeader =
    lower.startsWith("## memory writing agent:") ||
    lower.startsWith("memory writing agent:");
  if (!startsWithMemoryAgentHeader) {
    return false;
  }
  return lower.includes("consolidation") || lower.includes("phase 2");
}

export function isCommitMessageHelperPreview(value: string): boolean {
  const preview = value.trim();
  if (!preview) {
    return false;
  }
  return COMMIT_MESSAGE_HELPER_PROMPT_PREFIXES.some((prefix) =>
    preview.startsWith(prefix),
  );
}

export function isCodexBackgroundHelperPreview(value: string): boolean {
  const preview = value.trim();
  if (!preview) {
    return false;
  }
  if (isCommitMessageHelperPreview(preview)) {
    return true;
  }
  if (
    CODEX_BACKGROUND_HELPER_PROMPT_PREFIXES.some((prefix) =>
      preview.startsWith(prefix),
    )
  ) {
    return true;
  }
  return hasMemoryWritingAgentSignature(preview);
}

export function hasCodexBackgroundHelperPreview(values: string[]): boolean {
  return values.some(isCodexBackgroundHelperPreview);
}

export function hasCommitMessageHelperPreview(values: string[]): boolean {
  return values.some(isCommitMessageHelperPreview);
}
