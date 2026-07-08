import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appendLiveAssistantText,
  clearLiveAssistantText,
  drainLiveAssistantTextTail,
  getLiveAssistantTextSnapshot,
  renameLiveAssistantTextThread,
  resetLiveAssistantTextChannelForTests,
  subscribeLiveAssistantText,
} from "./liveAssistantTextChannel";

describe("liveAssistantTextChannel", () => {
  afterEach(() => {
    resetLiveAssistantTextChannelForTests();
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
    expect(snapshot?.text).toBe("Hello world");
    expect(snapshot?.shellTextLength).toBe("Hello".length);
  });

  it("resets the entry when the itemId changes (new turn or segment)", () => {
    appendLiveAssistantText("t1", "item-1", "first turn");
    expect(appendLiveAssistantText("t1", "item-2", "second")).toEqual({
      isFirst: true,
    });
    expect(getLiveAssistantTextSnapshot("t1")?.text).toBe("second");
  });

  it("notifies subscribers on append and clear, with stable snapshots between changes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLiveAssistantText("t1", listener);

    appendLiveAssistantText("t1", "item-1", "a");
    expect(listener).toHaveBeenCalledTimes(1);

    const first = getLiveAssistantTextSnapshot("t1");
    expect(getLiveAssistantTextSnapshot("t1")).toBe(first);

    appendLiveAssistantText("t1", "item-1", "b");
    expect(listener).toHaveBeenCalledTimes(2);
    expect(getLiveAssistantTextSnapshot("t1")).not.toBe(first);

    clearLiveAssistantText("t1");
    expect(listener).toHaveBeenCalledTimes(3);
    expect(getLiveAssistantTextSnapshot("t1")).toBeNull();

    unsubscribe();
    appendLiveAssistantText("t1", "item-1", "c");
    expect(listener).toHaveBeenCalledTimes(3);
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
    expect(getLiveAssistantTextSnapshot("claude:s1")?.text).toBe(
      "streamed more",
    );
  });
});
