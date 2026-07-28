import { beforeEach, describe, expect, it } from "vitest";

import {
  beginTurn,
  endTurn,
  getSharedTargetState,
  resetSharedTargetStoreForTests,
  selectNextTarget,
} from "./targetStore";
import { bindingKeyOf, freezeTurnSnapshot, resolveSnapshotProviderLabel } from "./types";

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

  it("falls back to profile id then default", () => {
    expect(
      resolveSnapshotProviderLabel(freezeTurnSnapshot({ engine: "claude", providerProfileId: "p1" })),
    ).toBe("p1");
    expect(
      resolveSnapshotProviderLabel(freezeTurnSnapshot({ engine: "claude" })),
    ).toBe("本地配置");
  });
});
