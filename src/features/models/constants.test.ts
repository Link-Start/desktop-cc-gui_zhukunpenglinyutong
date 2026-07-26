// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  STORAGE_KEYS,
  applyModelMapping,
  getModelMapping,
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
      applyModelMapping("Cxn[1m]", "Cxn[1m]", {
        opus: "glm-4.7",
      }),
    ).toBe("Cxn[1m]");
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

    saveModelMapping({ opus: "claude-opus-custom" });

    expect(window.localStorage.getItem(STORAGE_KEYS.CLAUDE_MODEL_MAPPING)).toBe(
      JSON.stringify({ opus: "claude-opus-custom" }),
    );
    expect(window.localStorage.getItem("mossx-claude-model-mapping")).toBeNull();
    expect(window.localStorage.getItem("codemoss-claude-model-mapping")).toBeNull();
  });
});
