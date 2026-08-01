import { describe, expect, it } from "vitest";

import {
  applyPickerSelection,
  buildTargetPickerOptions,
  validatePickerSelection,
  type TargetPickerCatalog,
} from "./targetPicker";
import type { ExecutionTarget } from "./types";

const CATALOG: TargetPickerCatalog = {
  engines: [
    { value: "claude", label: "Claude Code" },
    { value: "codex", label: "Codex CLI" },
    { value: "gemini", label: "Gemini CLI", disabled: true, disabledReason: "unsupported" },
  ],
  providersByEngine: {
    claude: [
      { value: "official", label: "Official" },
      { value: "openrouter", label: "OpenRouter" },
    ],
    codex: [{ value: "openai", label: "OpenAI" }],
  },
  modelsByBinding: {
    "claude:official": [{ value: "opus", label: "Opus" }, { value: "sonnet", label: "Sonnet" }],
    "claude:openrouter": [{ value: "sonnet", label: "Sonnet" }],
    "codex:openai": [{ value: "gpt-5", label: "GPT-5" }],
  },
  reasoningByModel: {
    "gpt-5": [{ value: "low", label: "Low" }, { value: "high", label: "High" }],
  },
};

describe("buildTargetPickerOptions", () => {
  it("returns empty lower levels without an engine selection", () => {
    const options = buildTargetPickerOptions(null, CATALOG);
    expect(options.engine).toHaveLength(3);
    expect(options.provider).toEqual([]);
    expect(options.model).toEqual([]);
    expect(options.reasoning).toEqual([]);
  });

  it("scopes provider and model options to the selected target", () => {
    const target: ExecutionTarget = { engine: "claude", providerProfileId: "openrouter" };
    const options = buildTargetPickerOptions(target, CATALOG);
    expect(options.provider.map((o) => o.value)).toEqual(["official", "openrouter"]);
    expect(options.model.map((o) => o.value)).toEqual(["sonnet"]);
  });

  it("scopes reasoning options to the selected model", () => {
    const target: ExecutionTarget = {
      engine: "codex",
      providerProfileId: "openai",
      model: "gpt-5",
    };
    const options = buildTargetPickerOptions(target, CATALOG);
    expect(options.reasoning.map((o) => o.value)).toEqual(["low", "high"]);
  });
});

describe("applyPickerSelection", () => {
  it("engine change resets provider/model/reasoning", () => {
    const current: ExecutionTarget = {
      engine: "claude",
      providerProfileId: "official",
      model: "opus",
      reasoning: { effort: "high" },
    };
    const next = applyPickerSelection(current, "engine", "codex");
    expect(next).toEqual({ engine: "codex" });
  });

  it("provider change resets model and reasoning but keeps engine", () => {
    const current: ExecutionTarget = {
      engine: "claude",
      providerProfileId: "official",
      model: "opus",
      reasoning: { effort: "high" },
    };
    const next = applyPickerSelection(current, "provider", "openrouter");
    expect(next).toEqual({ engine: "claude", providerProfileId: "openrouter" });
  });

  it("model change keeps reasoning selection", () => {
    const current: ExecutionTarget = {
      engine: "codex",
      providerProfileId: "openai",
      model: "gpt-5",
      reasoning: { effort: "low" },
    };
    const next = applyPickerSelection(current, "model", "gpt-5-mini");
    expect(next.model).toBe("gpt-5-mini");
    expect(next.reasoning).toEqual({ effort: "low" });
  });

  it("reasoning change preserves the rest of the target", () => {
    const current: ExecutionTarget = {
      engine: "codex",
      providerProfileId: "openai",
      model: "gpt-5",
    };
    const next = applyPickerSelection(current, "reasoning", "high");
    expect(next).toEqual({ ...current, reasoning: { effort: "high" } });
  });

  it("empty provider value maps to default-provider semantics", () => {
    const next = applyPickerSelection({ engine: "claude", providerProfileId: "official" }, "provider", "  ");
    expect(next.providerProfileId).toBeNull();
  });
});

describe("validatePickerSelection", () => {
  it("accepts a fully valid selection", () => {
    const target: ExecutionTarget = {
      engine: "claude",
      providerProfileId: "official",
      model: "opus",
    };
    expect(validatePickerSelection(target, CATALOG)).toEqual({ valid: true });
  });

  it("rejects a disabled engine", () => {
    const target: ExecutionTarget = { engine: "gemini" };
    expect(validatePickerSelection(target, CATALOG)).toEqual({
      valid: false,
      invalidLevel: "engine",
    });
  });

  it("rejects a provider outside the engine catalog", () => {
    const target: ExecutionTarget = { engine: "codex", providerProfileId: "openrouter" };
    expect(validatePickerSelection(target, CATALOG)).toEqual({
      valid: false,
      invalidLevel: "provider",
    });
  });

  it("rejects a model outside the provider catalog", () => {
    const target: ExecutionTarget = {
      engine: "claude",
      providerProfileId: "openrouter",
      model: "opus",
    };
    expect(validatePickerSelection(target, CATALOG)).toEqual({
      valid: false,
      invalidLevel: "model",
    });
  });
});
