import { describe, expect, it } from "vitest";
import { bestFuzzyMatchScore, scoreFuzzyMatch } from "./fuzzy";

describe("scoreFuzzyMatch", () => {
  it("orders exact, prefix, substring and subsequence matches", () => {
    const scores = [
      scoreFuzzyMatch("file", "file"),
      scoreFuzzyMatch("file", "FileView"),
      scoreFuzzyMatch("file", "open-file-view"),
      scoreFuzzyMatch("fvw", "FileViewWindow"),
    ];

    expect(scores.every((score) => score !== null)).toBe(true);
    expect(scores).toEqual([...scores].sort((left, right) => (left ?? 0) - (right ?? 0)));
  });

  it("matches FileViewPanel with the fvp abbreviation", () => {
    expect(scoreFuzzyMatch("fvp", "FileViewPanel.tsx")).not.toBeNull();
  });

  it("matches POSIX and Windows paths with the same semantics", () => {
    expect(scoreFuzzyMatch("fvp", "src/features/FileViewPanel.tsx")).not.toBeNull();
    expect(scoreFuzzyMatch("fvp", "src\\features\\FileViewPanel.tsx")).not.toBeNull();
  });

  it("returns null when the ordered characters are absent", () => {
    expect(scoreFuzzyMatch("fvp", "FilePanelView.tsx")).toBeNull();
  });
});

describe("bestFuzzyMatchScore", () => {
  it("returns the strongest candidate score", () => {
    expect(bestFuzzyMatchScore("git", ["Version Control", "Git", "Open Git Panel"]))
      .toBe(0);
  });
});
