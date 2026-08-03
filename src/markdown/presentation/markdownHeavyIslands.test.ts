import { describe, expect, it } from "vitest";
import {
  countMarkdownTableRowsFromNode,
  HEAVY_CODE_BLOCK_MIN_CHARS,
  HEAVY_CODE_BLOCK_MIN_LINES,
  HEAVY_TABLE_MIN_ROWS,
  MARKDOWN_HEAVY_ISLAND_DEFER_ENABLED,
  shouldDeferCodeBlock,
  shouldDeferMarkdownTable,
} from "./markdownHeavyIslands";

describe("markdownHeavyIslands", () => {
  it("counts nested markdown table rows from a hast-like node tree", () => {
    expect(
      countMarkdownTableRowsFromNode({
        tagName: "table",
        children: [
          {
            tagName: "tbody",
            children: [
              { tagName: "tr", children: [] },
              { tagName: "tr", children: [] },
              { tagName: "tr", children: [] },
            ],
          },
        ],
      }),
    ).toBe(3);
  });

  it("keeps the product kill-switch off so heavy islands never defer", () => {
    expect(MARKDOWN_HEAVY_ISLAND_DEFER_ENABLED).toBe(false);
    expect(shouldDeferCodeBlock({ valueLength: 4_100, lineCount: 12 })).toBe(false);
    expect(shouldDeferCodeBlock({ valueLength: 320, lineCount: 44 })).toBe(false);
    expect(shouldDeferMarkdownTable(12)).toBe(false);
    // Thresholds remain defined for a future re-enable.
    expect(HEAVY_CODE_BLOCK_MIN_LINES).toBeGreaterThan(0);
    expect(HEAVY_CODE_BLOCK_MIN_CHARS).toBeGreaterThan(0);
    expect(HEAVY_TABLE_MIN_ROWS).toBeGreaterThan(0);
  });

  it("documents historical defer thresholds for multi-line code blocks", () => {
    // When MARKDOWN_HEAVY_ISLAND_DEFER_ENABLED is re-enabled, policy should be:
    // lineCount >= HEAVY_CODE_BLOCK_MIN_LINES || valueLength >= HEAVY_CODE_BLOCK_MIN_CHARS
    const wouldDeferByChars = 4_100 >= HEAVY_CODE_BLOCK_MIN_CHARS;
    const wouldDeferByLines = 44 >= HEAVY_CODE_BLOCK_MIN_LINES;
    const wouldNotDefer = 4 < HEAVY_CODE_BLOCK_MIN_LINES && 320 < HEAVY_CODE_BLOCK_MIN_CHARS;
    expect(wouldDeferByChars).toBe(true);
    expect(wouldDeferByLines).toBe(true);
    expect(wouldNotDefer).toBe(true);
  });

  it("documents historical defer thresholds for markdown tables", () => {
    expect(11 < HEAVY_TABLE_MIN_ROWS).toBe(true);
    expect(12 >= HEAVY_TABLE_MIN_ROWS).toBe(true);
  });
});
