import { describe, expect, it } from "vitest";

import {
  assertEngineExecutionEnabled,
  isEngineExecutionEnabled,
  normalizeEngineForExecution,
} from "./engineExecutionPolicy";

describe("engineExecutionPolicy", () => {
  it("keeps Gemini history-compatible while rejecting it for new execution", () => {
    expect(isEngineExecutionEnabled("gemini")).toBe(false);
    expect(normalizeEngineForExecution("gemini")).toBe("codex");
    expect(() => assertEngineExecutionEnabled("gemini")).toThrow(
      "Gemini CLI is disabled in this client",
    );
  });

  it("preserves supported execution engines", () => {
    expect(normalizeEngineForExecution("claude")).toBe("claude");
    expect(normalizeEngineForExecution("opencode")).toBe("opencode");
  });
});
