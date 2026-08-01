export const HEAVY_CODE_BLOCK_MIN_LINES = 40;
export const HEAVY_CODE_BLOCK_MIN_CHARS = 4_000;
export const HEAVY_TABLE_MIN_ROWS = 12;

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
  return input.lineCount >= HEAVY_CODE_BLOCK_MIN_LINES || input.valueLength >= HEAVY_CODE_BLOCK_MIN_CHARS;
}

export function shouldDeferMarkdownTable(rowCount: number) {
  return rowCount >= HEAVY_TABLE_MIN_ROWS;
}
