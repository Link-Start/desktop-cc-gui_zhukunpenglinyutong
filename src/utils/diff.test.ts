import { describe, expect, it } from "vitest";
import * as diffModule from "./diff";

type DiffExports = typeof diffModule & {
  computeDiff: (oldStr: string, newStr: string) => {
    additions: number;
    deletions: number;
    lines: Array<{ type: "unchanged" | "deleted" | "added"; content: string }>;
  };
  computeDiffStats: (
    oldStr: string,
    newStr: string,
  ) => { additions: number; deletions: number };
  computeDiffFromUnifiedPatch: (
    diffText: string,
  ) => { additions: number; deletions: number };
};

const { computeDiff, computeDiffStats, computeDiffFromUnifiedPatch, parseDiff } =
  diffModule as DiffExports;

function buildLines(prefix: string, count: number) {
  return Array.from({ length: count }, (_, index) => `${prefix}${index}`).join("\n");
}

describe("diff utilities", () => {
  it("falls back deterministically when line counts exceed the MAX_LCS_PRODUCT guard", () => {
    const oldText = buildLines("old-", 501);
    const newText = buildLines("new-", 500);

    const result = computeDiff(oldText, newText);

    expect(result.deletions).toBe(501);
    expect(result.additions).toBe(500);
    expect(result.lines).toHaveLength(1001);
    expect(result.lines[0]).toEqual({ type: "deleted", content: "old-0" });
    expect(result.lines[500]).toEqual({ type: "deleted", content: "old-500" });
    expect(result.lines[501]).toEqual({ type: "added", content: "new-0" });
    expect(result.lines[1000]).toEqual({ type: "added", content: "new-499" });
    expect(computeDiffStats(oldText, newText)).toEqual({
      additions: 500,
      deletions: 501,
    });
  });

  it("ignores unified patch file headers when counting additions and deletions", () => {
    expect(
      computeDiffFromUnifiedPatch(
        [
          "--- a/src/example.ts",
          "+++ b/src/example.ts",
          "@@ -1,2 +1,3 @@",
          " context",
          "-before",
          "+after",
          "+extra",
        ].join("\n"),
      ),
    ).toEqual({ additions: 2, deletions: 1 });
  });

  it("handles empty content, identical content, and trailing newline changes", () => {
    expect(computeDiff("", "")).toEqual({
      additions: 0,
      deletions: 0,
      lines: [],
    });
    expect(computeDiff("same", "same")).toEqual({
      additions: 0,
      deletions: 0,
      lines: [{ type: "unchanged", content: "same" }],
    });
    expect(computeDiff("same\n", "same")).toEqual({
      additions: 0,
      deletions: 1,
      lines: [
        { type: "unchanged", content: "same" },
        { type: "deleted", content: "" },
      ],
    });
  });

  it("parses existing unified diff hunks with coordinates and meta lines", () => {
    expect(
      parseDiff(
        [
          "--- a/example.ts",
          "+++ b/example.ts",
          "@@ -2,2 +2,3 @@",
          " same",
          "-old",
          "+new",
          "+extra",
          "\\ No newline at end of file",
          "@@ -10 +11 @@",
          "-tail",
          "+tail-updated",
        ].join("\n"),
      ),
    ).toEqual([
      { type: "hunk", oldLine: null, newLine: null, text: "@@ -2,2 +2,3 @@" },
      { type: "context", oldLine: 2, newLine: 2, text: "same" },
      { type: "del", oldLine: 3, newLine: null, text: "old" },
      { type: "add", oldLine: null, newLine: 3, text: "new" },
      { type: "add", oldLine: null, newLine: 4, text: "extra" },
      {
        type: "meta",
        oldLine: null,
        newLine: null,
        text: "\\ No newline at end of file",
      },
      { type: "hunk", oldLine: null, newLine: null, text: "@@ -10 +11 @@" },
      { type: "del", oldLine: 10, newLine: null, text: "tail" },
      { type: "add", oldLine: null, newLine: 11, text: "tail-updated" },
    ]);
  });
});
