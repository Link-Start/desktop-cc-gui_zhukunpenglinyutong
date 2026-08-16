import { describe, expect, it } from "vitest";

import {
  assertEngineExecutionEnabled,
  isEngineExecutionEnabled,
  normalizeEngineForExecution,
} from "./engineExecutionPolicy";

describe("engineExecutionPolicy", () => {
  it("keeps retired Gemini history-compatible while rejecting new execution", () => {
    expect(isEngineExecutionEnabled("gemini")).toBe(false);
    expect(normalizeEngineForExecution("gemini")).toBe("codex");
    expect(() => assertEngineExecutionEnabled("gemini")).toThrow(
      "Selected CLI engine is disabled by product policy",
    );
  });

  it("preserves supported execution engines", () => {
    expect(normalizeEngineForExecution("claude")).toBe("claude");
    expect(normalizeEngineForExecution("codex")).toBe("codex");
    expect(normalizeEngineForExecution("kimi")).toBe("kimi");
    expect(normalizeEngineForExecution("opencode")).toBe("opencode");
  });

  it("treats OpenCode as an executable engine", () => {
    expect(isEngineExecutionEnabled("opencode")).toBe(true);
    expect(() => assertEngineExecutionEnabled("opencode")).not.toThrow();
  });

  it("treats DSH as an executable Native engine", () => {
    expect(isEngineExecutionEnabled("dsh")).toBe(true);
    expect(normalizeEngineForExecution("dsh")).toBe("dsh");
    expect(() => assertEngineExecutionEnabled("dsh")).not.toThrow();
  });
});
