import { beforeEach, describe, expect, it } from "vitest";

import {
  beginSharedTargetPersist,
  beginTurn,
  endSharedTargetPersist,
  endTurn,
  getActiveTurnTargetForAttempt,
  getPersistGeneration,
  getSharedTargetState,
  hydrateSharedTargetState,
  isSharedTargetPersistInFlight,
  resetSharedTargetStoreForTests,
  selectNextTarget,
} from "./targetStore";
import {
  bindingKeyOf,
  freezeTurnSnapshot,
  isResolvedExecutionTarget,
  normalizePersistedExecutionTarget,
  resolveBackendAuthoritativeExecutionTarget,
  resolveSnapshotProviderLabel,
} from "./types";

const WS = "ws-1";
const THREAD = "thread-1";

beforeEach(() => {
  resetSharedTargetStoreForTests();
});

describe("SharedTargetStore", () => {
  it("starts empty", () => {
    expect(getSharedTargetState(WS, THREAD)).toEqual({
      selectedNextTarget: null,
      activeTurnTarget: null,
    });
  });

  it("selectNextTarget updates only the next selection", () => {
    selectNextTarget(WS, THREAD, { engine: "claude", providerProfileId: "p1" });
    const state = getSharedTargetState(WS, THREAD);
    expect(state.selectedNextTarget).toEqual({ engine: "claude", providerProfileId: "p1" });
    expect(state.activeTurnTarget).toBeNull();
  });

  it("skips equivalent hydrate so shell thrash does not bump generation or replace state", () => {
    const target = {
      engine: "claude" as const,
      providerProfileId: "p1",
      modelCatalogEntryId: "m1",
      model: "claude-opus",
      reasoning: { effort: "high" },
      providerProfileNameSnapshot: "Official",
      providerProfileSource: "managed" as const,
    };
    hydrateSharedTargetState(WS, THREAD, target);
    const first = getSharedTargetState(WS, THREAD);
    const gen1 = getPersistGeneration(WS, THREAD);

    // 语义相同、引用不同 → 不得写壳 / 不得 generation++
    hydrateSharedTargetState(WS, THREAD, { ...target });
    const second = getSharedTargetState(WS, THREAD);
    expect(second).toBe(first);
    expect(getPersistGeneration(WS, THREAD)).toBe(gen1);

    for (let i = 0; i < 30; i += 1) {
      hydrateSharedTargetState(WS, THREAD, {
        ...target,
        reasoning: { effort: "high" },
      });
    }
    expect(getSharedTargetState(WS, THREAD)).toBe(first);
    expect(getPersistGeneration(WS, THREAD)).toBe(gen1);
  });

  it("hydrates and clears the selected target without rewriting the active turn", () => {
    const activeSnapshot = freezeTurnSnapshot({
      engine: "claude",
      model: "active-runtime",
    });
    beginTurn(WS, THREAD, activeSnapshot, "attempt-active");

    hydrateSharedTargetState(WS, THREAD, {
      engine: "codex",
      providerProfileId: "provider-b",
    });
    expect(getSharedTargetState(WS, THREAD)).toEqual({
      selectedNextTarget: {
        engine: "codex",
        providerProfileId: "provider-b",
      },
      activeTurnTarget: activeSnapshot,
    });

    hydrateSharedTargetState(WS, THREAD, null);
    expect(getSharedTargetState(WS, THREAD)).toEqual({
      selectedNextTarget: null,
      activeTurnTarget: activeSnapshot,
    });
  });

  it("picker change after beginTurn does not rewrite active snapshot", () => {
    const snapshot = freezeTurnSnapshot(
      { engine: "claude", providerProfileId: "p1", model: "m1" },
      { providerProfileNameSnapshot: "Official" },
    );
    beginTurn(WS, THREAD, snapshot);

    selectNextTarget(WS, THREAD, { engine: "codex", providerProfileId: "p2" });

    const state = getSharedTargetState(WS, THREAD);
    expect(state.activeTurnTarget?.engine).toBe("claude");
    expect(state.activeTurnTarget?.providerProfileId).toBe("p1");
    expect(state.selectedNextTarget?.engine).toBe("codex");
  });

  it("endTurn clears active snapshot without touching next selection", () => {
    const snapshot = freezeTurnSnapshot({ engine: "claude" });
    beginTurn(WS, THREAD, snapshot);
    selectNextTarget(WS, THREAD, { engine: "codex" });
    endTurn(WS, THREAD);

    const state = getSharedTargetState(WS, THREAD);
    expect(state.activeTurnTarget).toBeNull();
    expect(state.selectedNextTarget?.engine).toBe("codex");
  });

  it("allows active target fallback only for the same durable attempt", () => {
    const snapshot = freezeTurnSnapshot({ engine: "codex", model: "runtime-a" });
    beginTurn(WS, THREAD, snapshot, "attempt-a");

    expect(getActiveTurnTargetForAttempt(WS, THREAD, "attempt-a")).toBe(snapshot);
    expect(getActiveTurnTargetForAttempt(WS, THREAD, "attempt-b")).toBeNull();

    endTurn(WS, THREAD);
    expect(getActiveTurnTargetForAttempt(WS, THREAD, "attempt-a")).toBeNull();
  });

  it("ignores a stale observer clearing a newer active Attempt", () => {
    const staleSnapshot = freezeTurnSnapshot({
      engine: "codex",
      model: "stale",
    });
    const currentSnapshot = freezeTurnSnapshot({
      engine: "codex",
      model: "current",
    });
    beginTurn(WS, THREAD, staleSnapshot, "attempt-stale");
    beginTurn(WS, THREAD, currentSnapshot, "attempt-current");

    expect(endTurn(WS, THREAD, "attempt-stale")).toBe(false);
    expect(getSharedTargetState(WS, THREAD).activeTurnTarget).toBe(
      currentSnapshot,
    );
    expect(endTurn(WS, THREAD, "attempt-current")).toBe(true);
    expect(getSharedTargetState(WS, THREAD).activeTurnTarget).toBeNull();
  });

  it("keeps state isolated per thread", () => {
    selectNextTarget(WS, THREAD, { engine: "claude" });
    selectNextTarget(WS, "thread-2", { engine: "codex" });

    expect(getSharedTargetState(WS, THREAD).selectedNextTarget?.engine).toBe("claude");
    expect(getSharedTargetState(WS, "thread-2").selectedNextTarget?.engine).toBe("codex");
  });
});

describe("freezeTurnSnapshot", () => {
  it("freezes the snapshot object", () => {
    const snapshot = freezeTurnSnapshot({ engine: "claude", model: "m1" });
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it("copies reasoning instead of sharing reference", () => {
    const reasoning = { effort: "high" };
    const snapshot = freezeTurnSnapshot({ engine: "claude", reasoning });
    expect(snapshot.reasoning).toEqual({ effort: "high" });
    expect(snapshot.reasoning).not.toBe(reasoning);
  });

  it("freezes catalog identity separately from the runtime model", () => {
    const snapshot = freezeTurnSnapshot({
      engine: "claude",
      providerProfileId: "provider-b",
      modelCatalogEntryId: "settings-reasoning",
      model: "deepseek-v4-pro",
    });

    expect(snapshot).toMatchObject({
      modelCatalogEntryId: "settings-reasoning",
      model: "deepseek-v4-pro",
    });
  });
});

describe("resolved Execution Target contract", () => {
  it.each(["codex", "kimi", "grok", "opencode", "pi"] as const)(
    "accepts explicit managed %s identity",
    (engine) => {
      expect(
        isResolvedExecutionTarget({
          engine,
          providerProfileId: "provider-a",
          modelCatalogEntryId: "catalog-a",
          model: "runtime-a",
          providerProfileNameSnapshot: "Provider A",
          providerProfileSource: "managed",
        }),
      ).toBe(true);
    },
  );

  it("accepts explicit local identity", () => {
    expect(
      isResolvedExecutionTarget({
        engine: "opencode",
        providerProfileId: null,
        modelCatalogEntryId: "catalog-local",
        model: "runtime-local",
        providerProfileNameSnapshot: "本地配置",
        providerProfileSource: "disk",
      }),
    ).toBe(true);
  });

  it("accepts PI local target as a resolved Shared engine", () => {
    expect(
      isResolvedExecutionTarget({
        engine: "pi",
        providerProfileId: null,
        modelCatalogEntryId: "kimi-coding/k3",
        model: "kimi-coding/k3",
        providerProfileNameSnapshot: "本地配置",
        providerProfileSource: "disk",
      }),
    ).toBe(true);
  });

  it("rejects unsupported Gemini targets", () => {
    expect(
      isResolvedExecutionTarget({
        engine: "gemini",
        providerProfileId: null,
        modelCatalogEntryId: "catalog-local",
        model: "runtime-local",
        providerProfileNameSnapshot: "本地配置",
        providerProfileSource: "disk",
      }),
    ).toBe(false);
  });

  it("keeps legacy partial metadata non-executable instead of guessing local", () => {
    const target = normalizePersistedExecutionTarget({ engine: "codex" });

    expect(target).toEqual({
      engine: "codex",
      providerProfileId: null,
      modelCatalogEntryId: null,
      model: null,
      reasoning: null,
      providerProfileNameSnapshot: null,
      providerProfileSource: null,
    });
    expect(isResolvedExecutionTarget(target)).toBe(false);
  });

  it("rejects missing provider provenance even when model fields exist", () => {
    expect(
      isResolvedExecutionTarget({
        engine: "codex",
        providerProfileId: null,
        modelCatalogEntryId: "catalog-local",
        model: "runtime-local",
        providerProfileNameSnapshot: "本地配置",
      }),
    ).toBe(false);
  });

  it("publishes only the normalized backend target that exactly matches the request", () => {
    const requestedTarget = {
      engine: "codex" as const,
      providerProfileId: " provider-a ",
      modelCatalogEntryId: " catalog-a ",
      model: " runtime-a ",
      reasoning: { effort: " high " },
      providerProfileNameSnapshot: " Provider A ",
      providerProfileSource: "managed" as const,
    };

    expect(
      resolveBackendAuthoritativeExecutionTarget(
        {
          selectedTarget: {
            engine: "codex",
            providerProfileId: "provider-a",
            modelCatalogEntryId: "catalog-a",
            model: "runtime-a",
            reasoning: { effort: "high" },
            providerProfileNameSnapshot: "Provider A",
            providerProfileSource: "managed",
          },
        },
        requestedTarget,
      ),
    ).toEqual({
      engine: "codex",
      providerProfileId: "provider-a",
      modelCatalogEntryId: "catalog-a",
      model: "runtime-a",
      reasoning: { effort: "high" },
      providerProfileNameSnapshot: "Provider A",
      providerProfileSource: "managed",
    });
  });

  it("fails closed when backend target is missing or mismatched", () => {
    const requestedTarget = {
      engine: "codex" as const,
      providerProfileId: "provider-a",
      modelCatalogEntryId: "catalog-a",
      model: "runtime-a",
      providerProfileNameSnapshot: "Provider A",
      providerProfileSource: "managed" as const,
    };

    expect(() =>
      resolveBackendAuthoritativeExecutionTarget({}, requestedTarget),
    ).toThrow("malformed");
    expect(() =>
      resolveBackendAuthoritativeExecutionTarget(
        {
          selectedTarget: {
            ...requestedTarget,
            providerProfileId: "provider-b",
          },
        },
        requestedTarget,
      ),
    ).toThrow("mismatched");
  });
});

describe("bindingKeyOf", () => {
  it("keys by engine plus provider profile", () => {
    expect(bindingKeyOf({ engine: "claude", providerProfileId: "p1" })).toBe("claude:p1");
  });

  it("falls back to default provider segment", () => {
    expect(bindingKeyOf({ engine: "claude", providerProfileId: null })).toBe("claude:default");
    expect(bindingKeyOf({ engine: "claude" })).toBe("claude:default");
    expect(bindingKeyOf({ engine: "claude", providerProfileId: "  " })).toBe("claude:default");
  });

  it("does not include model in the key", () => {
    expect(bindingKeyOf({ engine: "codex", providerProfileId: "p1" })).toBe("codex:p1");
  });
});

describe("resolveSnapshotProviderLabel", () => {
  it("prefers the provider name snapshot", () => {
    const snapshot = freezeTurnSnapshot(
      { engine: "claude", providerProfileId: "p1" },
      { providerProfileNameSnapshot: "OpenRouter" },
    );
    expect(resolveSnapshotProviderLabel(snapshot)).toBe("OpenRouter");
  });

  it("falls back to profile id and freezes explicit local semantics", () => {
    expect(
      resolveSnapshotProviderLabel(freezeTurnSnapshot({ engine: "claude", providerProfileId: "p1" })),
    ).toBe("p1");
    expect(
      resolveSnapshotProviderLabel(freezeTurnSnapshot({ engine: "claude" })),
    ).toBe("本地配置");
    expect(
      resolveSnapshotProviderLabel(
        freezeTurnSnapshot({
          engine: "claude",
          providerProfileSource: "disk",
        }),
      ),
    ).toBe("本地配置");
  });

  it("keeps a raw legacy snapshot without provider facts unknown", () => {
    expect(
      resolveSnapshotProviderLabel({ engine: "claude" }),
    ).toBe("历史配置未知");
  });
});

describe("persistGeneration", () => {
  const WS2 = "ws-gen";
  const THREAD2 = "thread-gen";

  beforeEach(() => {
    resetSharedTargetStoreForTests();
  });

  it("starts at 0 for unknown thread", () => {
    expect(getPersistGeneration(WS2, THREAD2)).toBe(0);
  });

  it("increments after hydrate", () => {
    hydrateSharedTargetState(WS2, THREAD2, { engine: "claude" });
    expect(getPersistGeneration(WS2, THREAD2)).toBe(1);
    hydrateSharedTargetState(WS2, THREAD2, { engine: "codex" });
    expect(getPersistGeneration(WS2, THREAD2)).toBe(2);
  });

  it("does not increment on beginTurn or endTurn", () => {
    beginTurn(WS2, THREAD2, freezeTurnSnapshot({ engine: "claude" }));
    expect(getPersistGeneration(WS2, THREAD2)).toBe(0);
  });

  it("is thread-isolated", () => {
    hydrateSharedTargetState(WS2, "thread-a", { engine: "claude" });
    hydrateSharedTargetState(WS2, "thread-b", { engine: "codex" });
    expect(getPersistGeneration(WS2, "thread-a")).toBe(1);
    expect(getPersistGeneration(WS2, "thread-b")).toBe(1);
  });
});

describe("shared target persist in-flight", () => {
  const WS3 = "ws-inflight";
  const THREAD3 = "thread-inflight";

  beforeEach(() => {
    resetSharedTargetStoreForTests();
  });

  it("tracks begin/end persist in-flight", () => {
    expect(isSharedTargetPersistInFlight(WS3, THREAD3)).toBe(false);
    beginSharedTargetPersist(WS3, THREAD3);
    expect(isSharedTargetPersistInFlight(WS3, THREAD3)).toBe(true);
    beginSharedTargetPersist(WS3, THREAD3);
    expect(isSharedTargetPersistInFlight(WS3, THREAD3)).toBe(true);
    endSharedTargetPersist(WS3, THREAD3);
    expect(isSharedTargetPersistInFlight(WS3, THREAD3)).toBe(true);
    endSharedTargetPersist(WS3, THREAD3);
    expect(isSharedTargetPersistInFlight(WS3, THREAD3)).toBe(false);
  });
});
