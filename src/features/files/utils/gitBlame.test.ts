import { describe, expect, it } from "vitest";
import type { GitBlameHunk } from "../../../types";
import {
  findGitBlameHunk,
  formatGitBlameCompact,
  formatGitBlameDetails,
  normalizeGitBlameResponse,
  resolveGitBlameRepositoryPath,
} from "./gitBlame";

const hunk = (startLine: number, lineCount: number): GitBlameHunk => ({
  startLine,
  lineCount,
  commitSha: "0123456789abcdef",
  author: "Ada",
  authoredAt: 1_700_000_000,
  summary: "Explain the change",
  originalPath: null,
});

describe("gitBlame utilities", () => {
  it("maps a workspace path into a nested repository path", () => {
    expect(resolveGitBlameRepositoryPath("packages/app/src/main.ts", "packages/app")).toBe(
      "src/main.ts",
    );
    expect(resolveGitBlameRepositoryPath("src/main.ts", null)).toBe("src/main.ts");
  });

  it("sorts valid hunks and drops invalid ranges", () => {
    const normalized = normalizeGitBlameResponse({
      path: "src/main.ts",
      headSha: "head",
      lineCount: 8,
      hunks: [hunk(6, 4), hunk(1, 5), hunk(3, 2), hunk(0, 1), hunk(8, 0), hunk(9, 1)],
    });

    expect(normalized.hunks.map(({ startLine }) => startLine)).toEqual([1, 6]);
    expect(normalized.hunks[1]?.lineCount).toBe(3);
  });

  it("finds only the hunk containing the visible line", () => {
    const hunks = [hunk(1, 3), hunk(4, 2), hunk(8, 1)];
    expect(findGitBlameHunk(hunks, 1)?.startLine).toBe(1);
    expect(findGitBlameHunk(hunks, 5)?.startLine).toBe(4);
    expect(findGitBlameHunk(hunks, 6)).toBeNull();
  });

  it("formats compact and detailed commit metadata", () => {
    expect(formatGitBlameCompact(hunk(1, 1))).toContain("Ada");
    expect(formatGitBlameDetails(hunk(1, 1))).toContain("01234567");
    expect(formatGitBlameDetails(hunk(1, 1))).toContain("Explain the change");
  });
});
