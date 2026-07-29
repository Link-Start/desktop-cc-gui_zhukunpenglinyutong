import { describe, expect, it } from "vitest";

import {
  createBinding,
  findBinding,
  migrateBindingsByEngine,
  upsertBinding,
  type BindingsByTarget,
} from "./bindingsByTarget";

describe("bindingsByTarget", () => {
  it("holds two bindings for one engine with two providers", () => {
    let bindings: BindingsByTarget = {};
    bindings = upsertBinding(
      bindings,
      createBinding({ engine: "claude", providerProfileId: null }),
    );
    bindings = upsertBinding(
      bindings,
      createBinding({ engine: "claude", providerProfileId: "openrouter" }),
    );

    expect(Object.keys(bindings).sort()).toEqual(["claude:default", "claude:openrouter"]);
    expect(findBinding(bindings, { engine: "claude", providerProfileId: "openrouter" })?.bindingKey).toBe(
      "claude:openrouter",
    );
  });

  it("model switch within same engine and provider reuses the same key", () => {
    const bindings = upsertBinding(
      {},
      createBinding({ engine: "codex", providerProfileId: "openai" }),
    );

    const forGpt5 = findBinding(bindings, { engine: "codex", providerProfileId: "openai" });
    expect(forGpt5).not.toBeNull();
    // Model 不入 Key：同 engine+provider 的查找命中同一 Binding。
    expect(forGpt5?.bindingKey).toBe("codex:openai");
  });

  it("switch back reuses the original binding", () => {
    let bindings: BindingsByTarget = {};
    bindings = upsertBinding(
      bindings,
      createBinding({ engine: "claude", providerProfileId: null }, { nativeThreadId: "nt-1" }),
    );
    bindings = upsertBinding(
      bindings,
      createBinding({ engine: "codex", providerProfileId: "openai" }, { nativeThreadId: "nt-2" }),
    );

    // Claude/Official → Codex/OpenAI → Claude/Official
    const back = findBinding(bindings, { engine: "claude", providerProfileId: null });
    expect(back?.nativeThreadId).toBe("nt-1");
    expect(Object.keys(bindings)).toHaveLength(2);
  });

  it("migrates legacy engine-keyed bindings to default-provider semantics", () => {
    const migrated = migrateBindingsByEngine({
      claude: { nativeThreadId: "nt-legacy" },
      codex: { nativeThreadId: "nt-codex" },
    });

    expect(Object.keys(migrated).sort()).toEqual(["claude:default", "codex:default"]);
    expect(migrated["claude:default"].providerProfileId).toBeNull();
    expect(migrated["claude:default"].nativeThreadId).toBe("nt-legacy");
  });

  it("migration never fabricates a managed provider identity", () => {
    const migrated = migrateBindingsByEngine({
      claude: { nativeThreadId: "nt-legacy" },
    });

    for (const binding of Object.values(migrated)) {
      expect(binding.providerProfileId).toBeNull();
    }
  });

  it("upsertBinding is idempotent per binding key", () => {
    const binding = createBinding({ engine: "claude", providerProfileId: null });
    const once = upsertBinding({}, binding);
    const twice = upsertBinding(once, binding);
    expect(Object.keys(twice)).toHaveLength(1);
  });
});
