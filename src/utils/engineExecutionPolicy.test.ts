import { describe, expect, it } from "vitest";

import {
  assertEngineExecutionEnabled,
  isEngineExecutionEnabled,
  normalizeEngineForExecution,
} from "./engineExecutionPolicy";

describe("engineExecutionPolicy", () => {
  it("keeps retired engines history-compatible while rejecting new execution", () => {
    expect(isEngineExecutionEnabled("gemini")).toBe(false);
    expect(isEngineExecutionEnabled("opencode")).toBe(false);
    expect(normalizeEngineForExecution("gemini")).toBe("codex");
    expect(normalizeEngineForExecution("opencode")).toBe("codex");
    expect(() => assertEngineExecutionEnabled("gemini")).toThrow(
      "Selected CLI engine is disabled by product policy",
    );
  });

  it("preserves supported execution engines", () => {
    expect(normalizeEngineForExecution("claude")).toBe("claude");
    expect(normalizeEngineForExecution("codex")).toBe("codex");
    expect(normalizeEngineForExecution("kimi")).toBe("kimi");
  });
});
