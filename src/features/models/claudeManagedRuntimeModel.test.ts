import { describe, expect, it } from "vitest";
import {
  buildLegalClaudeRuntimes,
  isForeignClaudeRuntimeResidue,
  resolveClaudeManagedRuntimeModel,
} from "./claudeManagedRuntimeModel";

const deepseekCatalog = [
  {
    id: "claude-fable-5",
    model: "deepseek-v4-pro",
    isDefault: true,
  },
  {
    id: "claude-opus-5",
    model: "deepseek-v4-pro",
  },
  {
    id: "claude-sonnet-5",
    model: "deepseek-v4-pro",
  },
  {
    id: "claude-haiku-4-5-20251001",
    model: "deepseek-v4-flash",
  },
];

describe("claudeManagedRuntimeModel", () => {
  it("resolves tier entry id to mapped runtime without repair", () => {
    const result = resolveClaudeManagedRuntimeModel({
      entryId: "claude-fable-5",
      catalog: deepseekCatalog,
    });
    expect(result.runtime).toBe("deepseek-v4-pro");
    expect(result.entryId).toBe("claude-fable-5");
    expect(result.repaired).toBe(false);
  });

  it("repairs foreign k3 residue to catalog default", () => {
    const result = resolveClaudeManagedRuntimeModel({
      entryId: "k3",
      catalog: deepseekCatalog,
      fallbackRuntime: "k3",
    });
    expect(result.runtime).toBe("deepseek-v4-pro");
    expect(result.entryId).toBe("claude-fable-5");
    expect(result.repaired).toBe(true);
  });

  it("repairs kimi fallback when entry missing", () => {
    const result = resolveClaudeManagedRuntimeModel({
      entryId: "claude-sonnet-5-missing",
      catalog: deepseekCatalog,
      fallbackRuntime: "kimi-k3",
    });
    expect(result.runtime).toBe("deepseek-v4-pro");
    expect(result.repaired).toBe(true);
  });

  it("preserves legitimate freeform when not in catalog", () => {
    const result = resolveClaudeManagedRuntimeModel({
      entryId: "claude-opus-4-6",
      catalog: deepseekCatalog,
      fallbackRuntime: "claude-opus-4-6",
    });
    expect(result.runtime).toBe("claude-opus-4-6");
    expect(result.entryId).toBe("claude-opus-4-6");
    expect(result.repaired).toBe(false);
  });

  it("preserves custom freeform names", () => {
    const result = resolveClaudeManagedRuntimeModel({
      entryId: "my-org-router-v2",
      catalog: deepseekCatalog,
      fallbackRuntime: "my-org-router-v2",
    });
    expect(result.runtime).toBe("my-org-router-v2");
    expect(result.repaired).toBe(false);
  });

  it("detects foreign residue hints", () => {
    expect(isForeignClaudeRuntimeResidue("k3")).toBe(true);
    expect(isForeignClaudeRuntimeResidue("kimi-code/k3")).toBe(true);
    expect(isForeignClaudeRuntimeResidue("deepseek-v4-pro")).toBe(false);
    expect(isForeignClaudeRuntimeResidue("claude-opus-4-6")).toBe(false);
  });

  it("builds legal set from catalog runtimes and env slots (not bare tier ids alone)", () => {
    const legal = buildLegalClaudeRuntimes(deepseekCatalog, {
      ANTHROPIC_MODEL: "deepseek-v4-pro",
    });
    expect(legal.has("deepseek-v4-pro")).toBe(true);
    expect(legal.has("deepseek-v4-flash")).toBe(true);
    // tier id is only legal if it is also the runtime (unmapped builtin)
    expect(legal.has("claude-fable-5")).toBe(false);
  });

  it("allows freeform when catalog empty and not foreign", () => {
    const result = resolveClaudeManagedRuntimeModel({
      entryId: "my-custom-model",
      catalog: [],
      fallbackRuntime: "my-custom-model",
    });
    expect(result.runtime).toBe("my-custom-model");
    expect(result.repaired).toBe(false);
  });
});
