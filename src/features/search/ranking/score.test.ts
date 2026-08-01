import { describe, expect, it } from "vitest";
import type { SearchResult } from "../types";
import { compareSearchResults } from "./score";

describe("compareSearchResults", () => {
  it("uses recency boost when base score is equal", () => {
    const a: SearchResult = { id: "a", kind: "file", title: "A", score: 100 };
    const b: SearchResult = { id: "b", kind: "file", title: "B", score: 100 };
    const recency = { b: Date.now() };

    const sorted = [a, b].sort((left, right) => compareSearchResults(left, right, recency));
    expect(sorted[0]?.id).toBe("b");
  });

  it("keeps actions and navigation ahead of message content", () => {
    const results: SearchResult[] = [
      { id: "message", kind: "message", title: "Git", score: 0 },
      { id: "file", kind: "file", title: "git.ts", score: 500 },
      { id: "action", kind: "action", title: "Git", score: 500, actionId: "open-git" },
    ];

    results.sort((left, right) => compareSearchResults(left, right, {}));
    expect(results.map((result) => result.id)).toEqual(["action", "file", "message"]);
  });
});
