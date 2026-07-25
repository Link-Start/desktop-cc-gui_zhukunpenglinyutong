export function resolveBottomCommitMessageMenuPosition(
  triggerRect: Pick<DOMRect, "right" | "top">,
  menuSize: { width: number; height: number },
  viewport: { width: number; height: number },
) {
  const padding = 12;
  const maxX = Math.max(padding, viewport.width - menuSize.width - padding);
  const maxY = Math.max(padding, viewport.height - menuSize.height - padding);
  return {
    x: Math.min(Math.max(triggerRect.right - menuSize.width, padding), maxX),
    y: Math.min(Math.max(triggerRect.top - menuSize.height - 8, padding), maxY),
  };
}

export function getPathLeafName(value: string | null | undefined): string {
  if (!value) return "";
  const normalized = value.replace(/\\/g, "/").replace(/\/+$/, "");
  if (!normalized) return "";
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

export function normalizeRootPath(value: string | null | undefined) {
  return value ? value.replace(/\\/g, "/").replace(/\/+$/, "") : "";
}

export function isMissingRepo(error: string | null | undefined) {
  if (!error) return false;
  const normalized = error.toLowerCase();
  return (
    normalized.includes("could not find repository") ||
    normalized.includes("not a git repository") ||
    (normalized.includes("repository") && normalized.includes("notfound")) ||
    normalized.includes("repository not found") ||
    normalized.includes("git root not found")
  );
}
