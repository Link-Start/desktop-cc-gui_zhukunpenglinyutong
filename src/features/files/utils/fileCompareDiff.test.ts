import { describe, expect, it } from "vitest";
import { computeFileCompareDiff } from "./fileCompareDiff";

describe("computeFileCompareDiff", () => {
  it("marks changed line numbers across two files", () => {
    const result = computeFileCompareDiff(["a\nb\nc", "a\nb1\nc"]);

    expect(result.rowCount).toBe(3);
    expect(result.changedRows).toEqual([
      {
        rowIndex: 1,
        lineNumbersByColumn: [2, 2],
      },
    ]);
    expect(result.changedLineNumbersByColumn).toEqual([[2], [2]]);
    expect(result.gapLineCountsByColumn).toEqual([[], []]);
  });

  it("adds visual gaps for inserted and deleted rows", () => {
    const result = computeFileCompareDiff(["a\nb\nc", "a\nx\nc"]);

    expect(result.rowCount).toBe(4);
    expect(result.changedRows).toEqual([
      {
        rowIndex: 1,
        lineNumbersByColumn: [null, 2],
      },
      {
        rowIndex: 2,
        lineNumbersByColumn: [2, null],
      },
    ]);
    expect(result.changedLineNumbersByColumn).toEqual([[2], [2]]);
    expect(result.gapLineCountsByColumn).toEqual([
      [{ lineNumber: 2, count: 1 }],
      [{ lineNumber: 3, count: 1 }],
    ]);
  });

  it("supports missing rows in n-way compare", () => {
    const result = computeFileCompareDiff(["a\nb", "a", "a\nb\nc"]);

    expect(result.rowCount).toBe(3);
    expect(result.changedRows).toEqual([
      {
        rowIndex: 1,
        lineNumbersByColumn: [2, null, 2],
      },
      {
        rowIndex: 2,
        lineNumbersByColumn: [null, null, 3],
      },
    ]);
    expect(result.changedLineNumbersByColumn).toEqual([[2], [], [2, 3]]);
    expect(result.gapLineCountsByColumn).toEqual([
      [{ lineNumber: 3, count: 1 }],
      [{ lineNumber: 2, count: 2 }],
      [],
    ]);
  });
});
