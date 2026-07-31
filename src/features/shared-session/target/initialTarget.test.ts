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
