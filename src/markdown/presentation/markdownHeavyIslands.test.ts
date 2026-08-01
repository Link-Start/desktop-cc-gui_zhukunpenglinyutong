import { describe, expect, it } from "vitest";
import {
  countMarkdownTableRowsFromNode,
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

  it("defers only heavy multi-line code blocks", () => {
    expect(shouldDeferCodeBlock({ valueLength: 4_100, lineCount: 12 })).toBe(true);
    expect(shouldDeferCodeBlock({ valueLength: 320, lineCount: 44 })).toBe(true);
    expect(shouldDeferCodeBlock({ valueLength: 320, lineCount: 4 })).toBe(false);
  });

  it("defers markdown tables only after the shared row threshold", () => {
    expect(shouldDeferMarkdownTable(11)).toBe(false);
    expect(shouldDeferMarkdownTable(12)).toBe(true);
  });
});
