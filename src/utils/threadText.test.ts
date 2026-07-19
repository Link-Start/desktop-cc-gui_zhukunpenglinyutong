import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../types";
import { buildSemanticThreadNote } from "./threadText";

describe("buildSemanticThreadNote", () => {
  it("includes finalized dialogue, diff, and completed review only", () => {
    const items: ConversationItem[] = [
      { id: "user-1", kind: "message", role: "user", text: "wrapped request" },
      {
        id: "reasoning-1",
        kind: "reasoning",
        summary: "private summary",
        content: "private reasoning",
      },
      {
        id: "tool-1",
        kind: "tool",
        toolType: "shell",
        title: "Run",
        detail: "command",
        output: "transient output",
      },
      {
        id: "assistant-live",
        kind: "message",
        role: "assistant",
        text: "partial",
        isFinal: false,
      },
      {
        id: "assistant-final",
        kind: "message",
        role: "assistant",
        text: "final answer",
        isFinal: true,
      },
      { id: "diff-1", kind: "diff", title: "src/a.ts", diff: "+const value = 1;" },
      {
        id: "diff-live",
        kind: "diff",
        title: "src/live.ts",
        diff: "+const incomplete = true;",
        status: "running",
      },
      { id: "review-live", kind: "review", state: "started", text: "working" },
      { id: "review-final", kind: "review", state: "completed", text: "Looks good" },
    ];

    const result = buildSemanticThreadNote(items, {
      resolveUserMessageText: () => "visible request",
    });

    expect(result.includedItemIds).toEqual([
      "user-1",
      "assistant-final",
      "diff-1",
      "review-final",
    ]);
    expect(result.itemCount).toBe(4);
    expect(result.markdown).toContain("visible request");
    expect(result.markdown).toContain("final answer");
    expect(result.markdown).toContain("```diff");
    expect(result.markdown).toContain("Looks good");
    expect(result.markdown).not.toContain("private reasoning");
    expect(result.markdown).not.toContain("transient output");
    expect(result.markdown).not.toContain("partial");
    expect(result.markdown).not.toContain("working");
    expect(result.markdown).not.toContain("incomplete");
  });
});
