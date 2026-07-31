// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  STORAGE_KEYS,
  applyModelMapping,
  getModelMapping,
  migrateModelMappingStorage,
  resolveModelMappingValue,
  saveModelMapping,
} from "./constants";

afterEach(() => {
  window.localStorage.clear();
});

describe("model mapping", () => {
  it("maps sonnet and haiku families", () => {
    expect(
      applyModelMapping("Sonnet 4.5", "claude-sonnet-4-5-20250929", {
        sonnet: "glm-4.7",
      }),
    ).toBe("glm-4.7");

    expect(
      applyModelMapping("Haiku 4.5", "claude-haiku-4-5", {
        haiku: "glm-4.7-air",
      }),
    ).toBe("glm-4.7-air");
  });

  it("maps known opus families without inventing 1m built-ins", () => {
    expect(
      applyModelMapping("Opus 4.5", "claude-opus-4-5-20251101", {
        opus: "glm-4.7",
      }),
    ).toBe("glm-4.7");

    expect(
      applyModelMapping("Opus 4.6", "claude-opus-4-6", {
        opus: "glm-4.7",
      }),
    ).toBe("glm-4.7");

    expect(
      applyModelMapping("Opus 4.8", "claude-opus-4-8", {
        opus: "kimi-k3",
      }),
    ).toBe("kimi-k3");

    expect(
      applyModelMapping("Cxn[1m]", "Cxn[1m]", {
        opus: "glm-4.7",
      }),
    ).toBe("Cxn[1m]");
  });

  it("maps fable / sonnet 5 / haiku current ids and falls back to main", () => {
    expect(
      applyModelMapping("Fable 5", "claude-fable-5", {
        fable: "kimi-k3",
      }),
    ).toBe("kimi-k3");

    expect(
      applyModelMapping("Sonnet 5", "claude-sonnet-5", {
        sonnet: "kimi-k3",
      }),
    ).toBe("kimi-k3");

    expect(
      applyModelMapping("Haiku 4.5", "claude-haiku-4-5-20251001", {
        haiku: "kimi-k3",
      }),
    ).toBe("kimi-k3");

    // Tier-specific empty → main fallback
    expect(
      resolveModelMappingValue("claude-opus-4-8", {
        main: "kimi-k3",
      }),
    ).toBe("kimi-k3");
  });

  it("resolves mapped runtime model values separately from display fallback", () => {
    expect(
      resolveModelMappingValue("claude-sonnet-4-6", {
        sonnet: "GLM-5.1",
      }),
    ).toBe("GLM-5.1");

    expect(resolveModelMappingValue("Cxn[1m]", {
      opus: "glm-4.7",
    })).toBeNull();
  });

  it("does not apply Claude main mapping to non-Claude catalog ids", () => {
    const mapping = { main: "deepseek-v4-pro" };

    // Codex / Grok / Kimi / arbitrary runtime names must stay unmapped
    expect(resolveModelMappingValue("gpt-5.6-sol", mapping)).toBeNull();
    expect(resolveModelMappingValue("gpt-5.6-terra", mapping)).toBeNull();
    expect(resolveModelMappingValue("gpt-5.6-luna", mapping)).toBeNull();
    expect(resolveModelMappingValue("gpt-5.5", mapping)).toBeNull();
    expect(resolveModelMappingValue("grok-build", mapping)).toBeNull();
    expect(resolveModelMappingValue("kimi-code/k3", mapping)).toBeNull();
    expect(resolveModelMappingValue("deepseek-v4-pro", mapping)).toBeNull();
    expect(resolveModelMappingValue("Cxn[1m]", mapping)).toBeNull();

    // Claude family / namespace still falls back to main
    expect(resolveModelMappingValue("claude-opus-4-8", mapping)).toBe(
      "deepseek-v4-pro",
    );
    expect(resolveModelMappingValue("settings-main", mapping)).toBe(
      "deepseek-v4-pro",
    );
    expect(resolveModelMappingValue("claude-unknown-tier", mapping)).toBe(
      "deepseek-v4-pro",
    );
  });

  it("falls back to a legacy key when an earlier candidate contains malformed JSON", () => {
    window.localStorage.setItem(STORAGE_KEYS.CLAUDE_MODEL_MAPPING, "{bad json");
    window.localStorage.setItem(
      "mossx-claude-model-mapping",
      JSON.stringify({ sonnet: "glm-4.7" }),
    );

    expect(getModelMapping()).toEqual({ sonnet: "glm-4.7" });
    expect(
      JSON.parse(
        window.localStorage.getItem(STORAGE_KEYS.CLAUDE_MODEL_MAPPING) ?? "{}",
      ),
    ).toEqual({ sonnet: "glm-4.7" });
    expect(
      window.localStorage.getItem("mossx-claude-model-mapping"),
    ).toBeNull();
  });

  it("writes only the canonical Claude mapping key", () => {
    window.localStorage.setItem("mossx-claude-model-mapping", "{}");
    window.localStorage.setItem("codemoss-claude-model-mapping", "{}");

    expect(saveModelMapping({ opus: "claude-opus-custom" })).toMatchObject({
      ok: true,
    });

    expect(window.localStorage.getItem(STORAGE_KEYS.CLAUDE_MODEL_MAPPING)).toBe(
      JSON.stringify({ opus: "claude-opus-custom" }),
    );
    expect(window.localStorage.getItem("mossx-claude-model-mapping")).toBeNull();
    expect(window.localStorage.getItem("codemoss-claude-model-mapping")).toBeNull();
  });

  it("preserves canonical mapping when legacy values coexist and migration repeats", () => {
    window.localStorage.setItem(
      STORAGE_KEYS.CLAUDE_MODEL_MAPPING,
      JSON.stringify({ sonnet: "canonical-model" }),
    );
    window.localStorage.setItem(
      "mossx-claude-model-mapping",
      JSON.stringify({ sonnet: "legacy-model" }),
    );

    expect(migrateModelMappingStorage().mapping).toEqual({
      sonnet: "canonical-model",
    });
    expect(migrateModelMappingStorage().mapping).toEqual({
      sonnet: "canonical-model",
    });
    expect(
      window.localStorage.getItem("mossx-claude-model-mapping"),
    ).toBeNull();
  });
});
