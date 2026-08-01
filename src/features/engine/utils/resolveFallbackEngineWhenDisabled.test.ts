import { describe, expect, it } from "vitest";
import { resolveFallbackEngineWhenDisabled } from "./resolveFallbackEngineWhenDisabled";

describe("resolveFallbackEngineWhenDisabled", () => {
  const candidates = [
    { type: "claude" as const, installed: true },
    { type: "codex" as const, installed: true },
    { type: "grok" as const, installed: true },
    { type: "kimi" as const, installed: false },
    { type: "opencode" as const, installed: true },
  ];

  it("returns null when the active engine is still enabled", () => {
    expect(
      resolveFallbackEngineWhenDisabled({
        activeEngine: "codex",
        disabledCliEngineIds: ["opencode"],
        candidates,
      }),
    ).toBeNull();
  });

  it("falls back to the first enabled installed engine in registry order", () => {
    expect(
      resolveFallbackEngineWhenDisabled({
        activeEngine: "codex",
        disabledCliEngineIds: ["codex"],
        candidates,
      }),
    ).toBe("claude");
  });

  it("skips disabled and uninstalled engines when choosing a fallback", () => {
    expect(
      resolveFallbackEngineWhenDisabled({
        activeEngine: "codex",
        disabledCliEngineIds: ["codex", "claude", "kimi"],
        candidates,
      }),
    ).toBe("grok");
  });

  it("preserves a disabled active engine for in-progress bound threads", () => {
    expect(
      resolveFallbackEngineWhenDisabled({
        activeEngine: "codex",
        disabledCliEngineIds: ["codex"],
        candidates,
        preserveDisabledActiveEngine: true,
      }),
    ).toBeNull();
  });

  it("returns null when every installed engine is disabled", () => {
    expect(
      resolveFallbackEngineWhenDisabled({
        activeEngine: "codex",
        disabledCliEngineIds: ["claude", "codex", "grok", "opencode"],
        candidates,
      }),
    ).toBeNull();
  });

  it("accepts a ReadonlySet for disabled ids", () => {
    expect(
      resolveFallbackEngineWhenDisabled({
        activeEngine: "codex",
        disabledCliEngineIds: new Set(["codex", "claude"]),
        candidates,
      }),
    ).toBe("grok");
  });
});
