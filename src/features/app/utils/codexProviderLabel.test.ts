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

  it("uses managed provider id as fallback and labels disk config as local", () => {
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
    ).toBe("local");
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

  it("labels Claude Code local settings as local", () => {
    expect(
      resolveEngineProviderLabel({
        ...codexThread,
        engineSource: "claude",
        providerProfileId: "__local_settings_json__",
        providerProfileName: "Local config",
      }),
    ).toBe("local");
  });

  it("keeps Kimi local/default labels hidden", () => {
    expect(
      resolveEngineProviderLabel({
        ...codexThread,
        engineSource: "kimi",
        providerProfileId: "__local_config_toml__",
        providerProfileName: "Local config",
      }),
    ).toBeNull();
  });
});
