import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  appendLiveAssistantText,
  clearLiveAssistantText,
  drainLiveAssistantTextTail,
  getLiveAssistantTextSnapshot,
  LIVE_ASSISTANT_TEXT_PUBLISH_INTERVAL_MS,
  renameLiveAssistantTextThread,
  resetLiveAssistantTextChannelForTests,
  subscribeLiveAssistantText,
  updateLiveAssistantTextSnapshot,
} from "./liveAssistantTextChannel";

describe("liveAssistantTextChannel", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(0);
  });

  afterEach(() => {
    resetLiveAssistantTextChannelForTests();
    vi.useRealTimers();
  });

  it("publishes cumulative snapshot growth without treating replacements as append", () => {
    expect(
      updateLiveAssistantTextSnapshot("thread-1", "item-1", "第一段"),
    ).toBe("first");
    expect(
      updateLiveAssistantTextSnapshot(
        "thread-1",
        "item-1",
        "第一段\n第二段",
      ),
    ).toBe("growth");
    expect(
      updateLiveAssistantTextSnapshot(
        "thread-1",
        "item-1",
        "第一段\n第二段",
      ),
    ).toBe("unchanged");
    expect(
      updateLiveAssistantTextSnapshot("thread-1", "item-1", "替换正文"),
    ).toBe("replacement");
    expect(getLiveAssistantTextSnapshot("thread-1")?.text).toBe("第一段");

    vi.advanceTimersByTime(LIVE_ASSISTANT_TEXT_PUBLISH_INTERVAL_MS);
    expect(getLiveAssistantTextSnapshot("thread-1")?.text).toBe(
      "第一段\n第二段",
    );
  });

  it("marks the first delta per item as isFirst and accumulates the rest", () => {
    expect(appendLiveAssistantText("t1", "item-1", "Hello")).toEqual({
      isFirst: true,
    });
    expect(appendLiveAssistantText("t1", "item-1", " world")).toEqual({
      isFirst: false,
    });

    const snapshot = getLiveAssistantTextSnapshot("t1");
    expect(snapshot?.itemId).toBe("item-1");
    expect(snapshot?.text).toBe("Hello");
    expect(snapshot?.shellTextLength).toBe("Hello".length);

    vi.advanceTimersByTime(LIVE_ASSISTANT_TEXT_PUBLISH_INTERVAL_MS);
    expect(getLiveAssistantTextSnapshot("t1")?.text).toBe("Hello world");
  });

  it("resets the entry when the itemId changes (new turn or segment)", () => {
    appendLiveAssistantText("t1", "item-1", "first turn");
    expect(appendLiveAssistantText("t1", "item-2", "second")).toEqual({
      isFirst: true,
    });
    expect(getLiveAssistantTextSnapshot("t1")?.text).toBe("second");
  });

  it("publishes the first entry immediately and keeps snapshots stable until trailing flush", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLiveAssistantText("t1", listener);

    appendLiveAssistantText("t1", "item-1", "a");
    expect(listener).toHaveBeenCalledTimes(1);

    const first = getLiveAssistantTextSnapshot("t1");
    expect(getLiveAssistantTextSnapshot("t1")).toBe(first);

    appendLiveAssistantText("t1", "item-1", "b");
    appendLiveAssistantText("t1", "item-1", "c");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getLiveAssistantTextSnapshot("t1")).toBe(first);

    vi.advanceTimersByTime(LIVE_ASSISTANT_TEXT_PUBLISH_INTERVAL_MS - 1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getLiveAssistantTextSnapshot("t1")).toBe(first);

    vi.advanceTimersByTime(1);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(getLiveAssistantTextSnapshot("t1")?.text).toBe("abc");

    clearLiveAssistantText("t1");
    expect(listener).toHaveBeenCalledTimes(3);
    expect(getLiveAssistantTextSnapshot("t1")).toBeNull();

    unsubscribe();
    appendLiveAssistantText("t1", "item-1", "next");
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("cancels a pending trailing publish when the entry is cleared", () => {
    const listener = vi.fn();
    subscribeLiveAssistantText("t1", listener);

    appendLiveAssistantText("t1", "item-1", "a");
    appendLiveAssistantText("t1", "item-1", "b");
    clearLiveAssistantText("t1");
    expect(listener).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(LIVE_ASSISTANT_TEXT_PUBLISH_INTERVAL_MS);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(getLiveAssistantTextSnapshot("t1")).toBeNull();
  });

  it("drains only the tail beyond the shell text and clears the entry", () => {
    appendLiveAssistantText("t1", "item-1", "shell");
    appendLiveAssistantText("t1", "item-1", " tail-1");
    appendLiveAssistantText("t1", "item-1", " tail-2");

    expect(drainLiveAssistantTextTail("t1")).toEqual({
      itemId: "item-1",
      tailDelta: " tail-1 tail-2",
    });
    expect(getLiveAssistantTextSnapshot("t1")).toBeNull();
  });

  it("returns null from drain when nothing beyond the shell has accumulated", () => {
    appendLiveAssistantText("t1", "item-1", "shell-only");
    expect(drainLiveAssistantTextTail("t1")).toBeNull();
    expect(getLiveAssistantTextSnapshot("t1")).toBeNull();
    expect(drainLiveAssistantTextTail("missing")).toBeNull();
  });

  it("migrates the entry and notifies both threads on rename", () => {
    const oldListener = vi.fn();
    const newListener = vi.fn();
    subscribeLiveAssistantText("pending-1", oldListener);
    subscribeLiveAssistantText("claude:s1", newListener);

    appendLiveAssistantText("pending-1", "item-1", "streamed");
    oldListener.mockClear();

    renameLiveAssistantTextThread("pending-1", "claude:s1");
    expect(getLiveAssistantTextSnapshot("pending-1")).toBeNull();
    expect(getLiveAssistantTextSnapshot("claude:s1")?.text).toBe("streamed");
    expect(oldListener).toHaveBeenCalledTimes(1);
    expect(newListener).toHaveBeenCalledTimes(1);

    // 后续 delta 继续累计在新 threadId 上，不再视为首条。
    expect(appendLiveAssistantText("claude:s1", "item-1", " more")).toEqual({
      isFirst: false,
    });
    expect(getLiveAssistantTextSnapshot("claude:s1")?.text).toBe("streamed");
    vi.advanceTimersByTime(LIVE_ASSISTANT_TEXT_PUBLISH_INTERVAL_MS);
    expect(getLiveAssistantTextSnapshot("claude:s1")?.text).toBe(
      "streamed more",
    );
  });

  it("renames the latest accumulated text and prevents the old timer from firing", () => {
    const oldListener = vi.fn();
    const newListener = vi.fn();
    subscribeLiveAssistantText("pending-1", oldListener);
    subscribeLiveAssistantText("claude:s1", newListener);

    appendLiveAssistantText("pending-1", "item-1", "shell");
    appendLiveAssistantText("pending-1", "item-1", " pending");
    oldListener.mockClear();

    renameLiveAssistantTextThread("pending-1", "claude:s1");
    expect(getLiveAssistantTextSnapshot("pending-1")).toBeNull();
    expect(getLiveAssistantTextSnapshot("claude:s1")?.text).toBe(
      "shell pending",
    );
    expect(oldListener).toHaveBeenCalledTimes(1);
    expect(newListener).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(LIVE_ASSISTANT_TEXT_PUBLISH_INTERVAL_MS);
    expect(oldListener).toHaveBeenCalledTimes(1);
    expect(newListener).toHaveBeenCalledTimes(1);
  });
});
