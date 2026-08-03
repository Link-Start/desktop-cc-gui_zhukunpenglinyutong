export const HEAVY_CODE_BLOCK_MIN_LINES = 40;
export const HEAVY_CODE_BLOCK_MIN_CHARS = 4_000;
export const HEAVY_TABLE_MIN_ROWS = 12;

/**
 * Product kill-switch for block-level heavy Markdown deferral
 * ("重型 Markdown 详情已延迟" / "显示详情").
 *
 * Keep thresholds + Deferred* UI code paths; set true to re-enable.
 */
export const MARKDOWN_HEAVY_ISLAND_DEFER_ENABLED = false;

export function countMarkdownTableRowsFromNode(node: unknown): number {
  if (!node || typeof node !== "object") return 0;
  const record = node as { tagName?: string; children?: unknown[] };
  const ownCount = record.tagName === "tr" ? 1 : 0;
  return ownCount + (Array.isArray(record.children)
    ? record.children.reduce<number>(
      (total, child) => total + countMarkdownTableRowsFromNode(child),
      0,
    )
    : 0);
}

export function shouldDeferCodeBlock(input: { valueLength: number; lineCount: number }) {
  if (!MARKDOWN_HEAVY_ISLAND_DEFER_ENABLED) {
    return false;
  }
  return input.lineCount >= HEAVY_CODE_BLOCK_MIN_LINES || input.valueLength >= HEAVY_CODE_BLOCK_MIN_CHARS;
}

export function shouldDeferMarkdownTable(rowCount: number) {
  if (!MARKDOWN_HEAVY_ISLAND_DEFER_ENABLED) {
    return false;
  }
  return rowCount >= HEAVY_TABLE_MIN_ROWS;
}
