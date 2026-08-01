import { describe, expect, it } from "vitest";
import {
  createModelCatalogCache,
  mergeModelCatalogSources,
  type ModelCatalogEntry,
} from "./modelProviderCatalog";

const entry = (
  source: ModelCatalogEntry["source"],
  label: string = source,
): ModelCatalogEntry => ({
  engine: "codex",
  provider: "openai",
  protocol: "openai-responses",
  id: "model-1",
  label,
  description: "",
  source,
  provenance: `test:${source}`,
});

describe("model provider catalog", () => {
  it("uses runtime > configured > cached > fallback with deterministic dedupe", () => {
    const merged = mergeModelCatalogSources([
      [entry("fallback")],
      [entry("cached")],
      [entry("configured")],
      [entry("runtime")],
      [entry("runtime", "later-runtime-owner")],
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.label).toBe("runtime");
    expect(merged[0]?.source).toBe("runtime");
  });

  it("preserves last-good entries when refresh fails", () => {
    const cache = createModelCatalogCache();
    const good = cache.commit([entry("runtime")], 10);
    const stale = cache.fail(new Error("model/list unavailable"));
    expect(stale.entries).toBe(good.entries);
    expect(stale).toMatchObject({
      stale: true,
      error: "model/list unavailable",
      refreshedAt: 10,
    });
  });
});
