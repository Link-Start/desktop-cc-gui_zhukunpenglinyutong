import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  appendLiveItemDelta,
  clearLiveItemDelta,
  clearLiveItemDeltaForItem,
  drainLiveItemDeltaTail,
  getLiveItemDeltaSnapshot,
  LIVE_ITEM_DELTA_PUBLISH_INTERVAL_MS,
  peekLiveItemDelta,
  peekLiveItemDeltaEntry,
  resetLiveItemDeltaChannelForTests,
  subscribeLiveItemDelta,
} from "./liveItemDeltaChannel";

describe("liveItemDeltaChannel", () => {
  beforeEach(() => {
    resetLiveItemDeltaChannelForTests();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  });

  afterEach(() => {
    resetLiveItemDeltaChannelForTests();
    vi.useRealTimers();
  });

  it("returns isFirst:true for the first delta of an item lane, false afterwards", () => {
    expect(appendLiveItemDelta("t1", "item-1", "reasoningContent", "先")).toEqual({
      isFirst: true,
    });
    expect(appendLiveItemDelta("t1", "item-1", "reasoningContent", "后")).toEqual({
      isFirst: false,
    });
  });

  it("returns isFirst:true again for a different lane or item", () => {
    appendLiveItemDelta("t1", "item-1", "reasoningContent", "a");
    expect(appendLiveItemDelta("t1", "item-1", "reasoningSummary", "b")).toEqual({
      isFirst: true,
    });
    expect(appendLiveItemDelta("t1", "item-2", "reasoningContent", "c")).toEqual({
      isFirst: true,
    });
  });

  it("accumulates deltas within the same lane", () => {
    appendLiveItemDelta("t1", "item-1", "toolOutput", "chunk-1 ");
    appendLiveItemDelta("t1", "item-1", "toolOutput", "chunk-2 ");
    appendLiveItemDelta("t1", "item-1", "toolOutput", "chunk-3");
    expect(peekLiveItemDelta("t1", "item-1", "toolOutput")).toBe(
      "chunk-1 chunk-2 chunk-3",
    );
  });

  it("keeps lanes isolated from each other", () => {
    appendLiveItemDelta("t1", "item-1", "reasoningContent", "content-");
    appendLiveItemDelta("t1", "item-1", "reasoningSummary", "summary-");
    appendLiveItemDelta("t1", "item-1", "toolOutput", "output-");
    appendLiveItemDelta("t1", "item-1", "reasoningContent", "more");

    expect(peekLiveItemDelta("t1", "item-1", "reasoningContent")).toBe("content-more");
    expect(peekLiveItemDelta("t1", "item-1", "reasoningSummary")).toBe("summary-");
    expect(peekLiveItemDelta("t1", "item-1", "toolOutput")).toBe("output-");
    expect(peekLiveItemDelta("t1", "missing", "reasoningContent")).toBe("");
  });

  it("publishes the first delta immediately, then throttles with a trailing publish", () => {
    const listener = vi.fn();
    subscribeLiveItemDelta("t1", listener);

    appendLiveItemDelta("t1", "item-1", "reasoningContent", "a");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getLiveItemDeltaSnapshot("t1").get("item-1:reasoningContent")).toBe("a");

    // 紧接着的累积只调度一次 trailing 发布。
    appendLiveItemDelta("t1", "item-1", "reasoningContent", "b");
    appendLiveItemDelta("t1", "item-1", "reasoningContent", "c");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getLiveItemDeltaSnapshot("t1").get("item-1:reasoningContent")).toBe("a");

    vi.advanceTimersByTime(LIVE_ITEM_DELTA_PUBLISH_INTERVAL_MS);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(getLiveItemDeltaSnapshot("t1").get("item-1:reasoningContent")).toBe("abc");

    // 距上次发布已超过 cadence：下一条累积立即发布（leading）。
    vi.advanceTimersByTime(LIVE_ITEM_DELTA_PUBLISH_INTERVAL_MS);
    expect(listener).toHaveBeenCalledTimes(2);
    appendLiveItemDelta("t1", "item-1", "reasoningContent", "d");
    expect(listener).toHaveBeenCalledTimes(3);
    expect(getLiveItemDeltaSnapshot("t1").get("item-1:reasoningContent")).toBe("abcd");

    // trailing 保证最后一次累积必发。
    appendLiveItemDelta("t1", "item-1", "reasoningContent", "e");
    vi.advanceTimersByTime(LIVE_ITEM_DELTA_PUBLISH_INTERVAL_MS);
    expect(getLiveItemDeltaSnapshot("t1").get("item-1:reasoningContent")).toBe("abcde");
  });

  it("keeps peek authoritative even before the throttled publish fires", () => {
    appendLiveItemDelta("t1", "item-1", "reasoningContent", "a");
    appendLiveItemDelta("t1", "item-1", "reasoningContent", "tail");
    expect(peekLiveItemDelta("t1", "item-1", "reasoningContent")).toBe("atail");
    expect(getLiveItemDeltaSnapshot("t1").get("item-1:reasoningContent")).toBe("a");
  });

  it("drains only the unpublished tail and clears the thread", () => {
    appendLiveItemDelta("t1", "item-1", "reasoningContent", "shell");
    appendLiveItemDelta("t1", "item-1", "reasoningContent", "-tail");
    appendLiveItemDelta("t1", "item-2", "toolOutput", "only-shell");

    const drained = drainLiveItemDeltaTail("t1");
    expect(drained).toEqual([
      { itemId: "item-1", lane: "reasoningContent", text: "-tail" },
    ]);
    expect(peekLiveItemDelta("t1", "item-1", "reasoningContent")).toBe("");
    expect(peekLiveItemDeltaEntry("t1", "item-1", "reasoningContent")).toBeNull();
    expect(drainLiveItemDeltaTail("t1")).toEqual([]);
  });

  it("notifies subscribers with an empty snapshot after drain", () => {
    const listener = vi.fn();
    subscribeLiveItemDelta("t1", listener);
    appendLiveItemDelta("t1", "item-1", "reasoningContent", "a");
    appendLiveItemDelta("t1", "item-1", "reasoningContent", "b");
    listener.mockClear();

    drainLiveItemDeltaTail("t1");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getLiveItemDeltaSnapshot("t1").size).toBe(0);
  });

  it("notifies subscribers with an empty snapshot after clear", () => {
    const listener = vi.fn();
    subscribeLiveItemDelta("t1", listener);
    appendLiveItemDelta("t1", "item-1", "reasoningSummary", "s");
    listener.mockClear();

    clearLiveItemDelta("t1");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getLiveItemDeltaSnapshot("t1").size).toBe(0);
    // 再有 pending trailing 也不许复活条目。
    vi.advanceTimersByTime(LIVE_ITEM_DELTA_PUBLISH_INTERVAL_MS * 2);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getLiveItemDeltaSnapshot("t1").size).toBe(0);
  });

  it("clears a single item without touching other items", () => {
    appendLiveItemDelta("t1", "item-1", "reasoningContent", "a");
    appendLiveItemDelta("t1", "item-1", "reasoningSummary", "b");
    appendLiveItemDelta("t1", "item-2", "toolOutput", "c");

    expect(clearLiveItemDeltaForItem("t1", "item-1")).toBe(true);
    expect(peekLiveItemDelta("t1", "item-1", "reasoningContent")).toBe("");
    expect(peekLiveItemDelta("t1", "item-1", "reasoningSummary")).toBe("");
    expect(peekLiveItemDelta("t1", "item-2", "toolOutput")).toBe("c");
    expect(clearLiveItemDeltaForItem("t1", "missing")).toBe(false);
  });

  it("keeps snapshot references stable between publishes and shares the empty map", () => {
    const emptyA = getLiveItemDeltaSnapshot("no-such-thread");
    const emptyB = getLiveItemDeltaSnapshot("another-missing");
    expect(emptyA).toBe(emptyB);

    appendLiveItemDelta("t1", "item-1", "reasoningContent", "a");
    const snapshot = getLiveItemDeltaSnapshot("t1");
    expect(getLiveItemDeltaSnapshot("t1")).toBe(snapshot);

    appendLiveItemDelta("t1", "item-1", "reasoningContent", "b");
    vi.advanceTimersByTime(LIVE_ITEM_DELTA_PUBLISH_INTERVAL_MS);
    const nextSnapshot = getLiveItemDeltaSnapshot("t1");
    expect(nextSnapshot).not.toBe(snapshot);
    expect(getLiveItemDeltaSnapshot("t1")).toBe(nextSnapshot);
  });

  it("unsubscribes listeners cleanly", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLiveItemDelta("t1", listener);
    unsubscribe();
    appendLiveItemDelta("t1", "item-1", "reasoningContent", "a");
    expect(listener).not.toHaveBeenCalled();
  });
});
