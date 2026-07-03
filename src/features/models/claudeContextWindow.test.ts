import { describe, expect, it } from "vitest";
import {
  DEFAULT_CLAUDE_CONTEXT_WINDOW,
  estimateClaudeContextWindow,
} from "./claudeContextWindow";

describe("estimateClaudeContextWindow", () => {
  it("defaults to the 1M window for modern Claude models", () => {
    expect(DEFAULT_CLAUDE_CONTEXT_WINDOW).toBe(1_000_000);
    expect(estimateClaudeContextWindow("claude-opus-4-8")).toBe(
      DEFAULT_CLAUDE_CONTEXT_WINDOW,
    );
    expect(estimateClaudeContextWindow("claude-sonnet-4.5")).toBe(
      DEFAULT_CLAUDE_CONTEXT_WINDOW,
    );
    expect(estimateClaudeContextWindow(null)).toBe(
      DEFAULT_CLAUDE_CONTEXT_WINDOW,
    );
    expect(estimateClaudeContextWindow("")).toBe(DEFAULT_CLAUDE_CONTEXT_WINDOW);
  });

  it("keeps the 200k window for Haiku models", () => {
    expect(estimateClaudeContextWindow("claude-haiku-4-5")).toBe(200_000);
    expect(estimateClaudeContextWindow("Claude-Haiku-4-5")).toBe(200_000);
  });

  it("treats [1m] long-context variants as 1M", () => {
    expect(estimateClaudeContextWindow("claude-sonnet-4-5[1m]")).toBe(
      1_000_000,
    );
    expect(estimateClaudeContextWindow("Claude-Sonnet-4-5[1M]")).toBe(
      1_000_000,
    );
  });
});
