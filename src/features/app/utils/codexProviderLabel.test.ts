import { describe, expect, it } from "vitest";
import type { ThreadSummary } from "../../../types";
import {
  resolveCodexProviderLabel,
  resolveEngineProviderLabel,
} from "./codexProviderLabel";

const codexThread: ThreadSummary = {
  id: "codex:session-1",
  name: "Codex Session",
  updatedAt: 1,
  engineSource: "codex",
};

describe("resolveCodexProviderLabel", () => {
  it("prefers provider name then source label", () => {
    expect(
      resolveCodexProviderLabel({
        ...codexThread,
        providerProfileName: "OpenAI",
        sourceLabel: "custom/openai",
      }),
    ).toBe("OpenAI");
    expect(
      resolveCodexProviderLabel({
        ...codexThread,
        providerProfileName: " ",
        sourceLabel: "custom/openai",
      }),
    ).toBe("custom/openai");
  });

  it("uses managed provider id as fallback but hides disk and empty bindings", () => {
    expect(
      resolveCodexProviderLabel({
        ...codexThread,
        providerProfileId: "provider-a",
      }),
    ).toBe("provider-a");
    expect(
      resolveCodexProviderLabel({
        ...codexThread,
        providerProfileId: "__disk__",
      }),
    ).toBeNull();
    expect(
      resolveCodexProviderLabel({
        ...codexThread,
        providerProfileId: " ",
        providerProfileName: " ",
        sourceLabel: " ",
      }),
    ).toBeNull();
  });

  it.each(["claude", "kimi"] as const)(
    "renders managed provider labels for %s threads",
    (engineSource) => {
      expect(
        resolveEngineProviderLabel({
          ...codexThread,
          engineSource,
          providerProfileId: "provider-a",
          providerProfileName: "Provider A",
        }),
      ).toBe("Provider A");
    },
  );

  it.each([
    ["claude", "__local_settings_json__"],
    ["kimi", "__local_config_toml__"],
  ] as const)("hides local/default labels for %s", (engineSource, providerProfileId) => {
    expect(
      resolveEngineProviderLabel({
        ...codexThread,
        engineSource,
        providerProfileId,
        providerProfileName: "Local config",
      }),
    ).toBeNull();
  });
});
