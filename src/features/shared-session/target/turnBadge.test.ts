import { describe, expect, it } from "vitest";

import { resolveTurnBadge } from "./turnBadge";
import { freezeTurnSnapshot } from "./types";

describe("resolveTurnBadge", () => {
  it("renders provider name snapshot and model from the frozen snapshot", () => {
    const snapshot = freezeTurnSnapshot(
      { engine: "claude", providerProfileId: "openrouter", model: "sonnet" },
      { providerProfileNameSnapshot: "OpenRouter" },
    );
    const badge = resolveTurnBadge(snapshot);
    expect(badge).toEqual({
      engine: "claude",
      providerLabel: "OpenRouter",
      modelLabel: "sonnet",
      reasoningLabel: null,
      unavailable: false,
      unavailableReason: null,
    });
  });

  it("keeps name snapshot readable after the provider is deleted", () => {
    const snapshot = freezeTurnSnapshot(
      { engine: "claude", providerProfileId: "openrouter" },
      { providerProfileNameSnapshot: "OpenRouter" },
    );
    const badge = resolveTurnBadge(snapshot, {
      providerExists: false,
      providerAvailable: false,
      runtimeAvailable: true,
    });
    expect(badge.providerLabel).toBe("OpenRouter");
    expect(badge.unavailable).toBe(true);
    expect(badge.unavailableReason).toBe("provider-deleted");
  });

  it("marks unavailable when provider config is missing", () => {
    const snapshot = freezeTurnSnapshot({ engine: "claude", providerProfileId: "zhipu" });
    const badge = resolveTurnBadge(snapshot, {
      providerExists: true,
      providerAvailable: false,
      runtimeAvailable: true,
    });
    expect(badge.unavailableReason).toBe("provider-missing");
  });

  it("marks unavailable when runtime is gone even if provider is fine", () => {
    const snapshot = freezeTurnSnapshot({ engine: "codex", providerProfileId: null });
    const badge = resolveTurnBadge(snapshot, {
      providerExists: true,
      providerAvailable: true,
      runtimeAvailable: false,
    });
    expect(badge.unavailableReason).toBe("runtime-missing");
  });

  it("uses a readable local label for legacy default-provider snapshots", () => {
    const snapshot = freezeTurnSnapshot({ engine: "claude" });
    const badge = resolveTurnBadge(snapshot);
    expect(badge.providerLabel).toBe("本地配置");
    expect(badge.unavailable).toBe(false);
  });
});
