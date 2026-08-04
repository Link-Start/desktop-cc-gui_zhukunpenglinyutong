import { describe, expect, it } from "vitest";

import { buildLocalSharedSessionInitialTarget } from "./initialTarget";

describe("buildLocalSharedSessionInitialTarget", () => {
  it("uses the selected CLI default model without borrowing composer state", () => {
    expect(
      buildLocalSharedSessionInitialTarget(
        "opencode",
        [
          {
            id: "opencode/first",
            displayName: "First",
            description: "",
            isDefault: false,
          },
          {
            id: "minimax-cn-coding-plan/MiniMax-M2.5",
            model: "minimax-cn-coding-plan/MiniMax-M2.5",
            displayName: "MiniMax M2.5",
            description: "",
            isDefault: true,
          },
        ],
        "本地配置",
        "OpenCode 没有可用于 Shared Session 的本地 Model。",
      ),
    ).toEqual({
      engine: "opencode",
      providerProfileId: null,
      modelCatalogEntryId: "minimax-cn-coding-plan/MiniMax-M2.5",
      model: "minimax-cn-coding-plan/MiniMax-M2.5",
      reasoning: null,
      providerProfileNameSnapshot: "本地配置",
      providerProfileSource: "disk",
    });
  });

  it("seeds Grok with null effort and does not invent Codex-tier options", () => {
    // Native Codex 可能残留 high/ultra；初始化 Shared Grok 时不得借用。
    expect(
      buildLocalSharedSessionInitialTarget(
        "grok",
        [
          {
            id: "grok-4-1-fast",
            model: "grok-4-1-fast",
            displayName: "Grok 4.5",
            description: "",
            isDefault: true,
            source: "builtin",
          },
        ],
        "本地配置",
        "Grok CLI 没有可用于 Shared Session 的本地 Model。",
      ),
    ).toEqual({
      engine: "grok",
      providerProfileId: null,
      modelCatalogEntryId: "grok-4-1-fast",
      model: "grok-4-1-fast",
      reasoning: null,
      providerProfileNameSnapshot: "本地配置",
      providerProfileSource: "disk",
    });
  });

  it("seeds Codex catalog model default effort without Native composer state", () => {
    expect(
      buildLocalSharedSessionInitialTarget(
        "codex",
        [
          {
            id: "gpt-5.6-sol",
            model: "gpt-5.6-sol",
            displayName: "gpt-5.6-sol",
            description: "",
            isDefault: true,
            source: "fallback",
          },
        ],
        "本地配置",
        "Codex 没有可用于 Shared Session 的本地 Model。",
      ),
    ).toEqual(
      expect.objectContaining({
        engine: "codex",
        modelCatalogEntryId: "gpt-5.6-sol",
        model: "gpt-5.6-sol",
        reasoning: { effort: "low" },
      }),
    );
  });

  it("fails closed when the selected CLI has no usable local model", () => {
    expect(() =>
      buildLocalSharedSessionInitialTarget(
        "grok",
        [],
        "本地配置",
        "Grok CLI 没有可用于 Shared Session 的本地 Model。",
      ),
    ).toThrow("Grok CLI");
  });
});
