// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  __resetComposerDraftStoreForTests,
  clearComposerDraft,
  getComposerDraft,
  setComposerDraft,
  useComposerDraft,
} from "./composerDraftStore";

describe("composerDraftStore", () => {
  afterEach(() => {
    __resetComposerDraftStoreForTests();
  });

  it("keeps drafts isolated per thread and detached", () => {
    setComposerDraft("thread-1", "hello");
    setComposerDraft("thread-2", "world");
    setComposerDraft(null, "detached");

    expect(getComposerDraft("thread-1")).toBe("hello");
    expect(getComposerDraft("thread-2")).toBe("world");
    expect(getComposerDraft(null)).toBe("detached");
    expect(getComposerDraft("thread-3")).toBe("");
  });

  it("clears a thread draft without touching others", () => {
    setComposerDraft("thread-1", "hello");
    setComposerDraft("thread-2", "world");

    clearComposerDraft("thread-1");

    expect(getComposerDraft("thread-1")).toBe("");
    expect(getComposerDraft("thread-2")).toBe("world");
  });

  it("re-renders subscribers only when their thread draft value changes", () => {
    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount += 1;
      return useComposerDraft("thread-1");
    });
    expect(result.current).toBe("");
    const mountRenderCount = renderCount;

    // 其他会话的草稿变化不打扰本订阅者。
    act(() => {
      setComposerDraft("thread-2", "elsewhere");
    });
    expect(renderCount).toBe(mountRenderCount);

    // 同值写入不通知。
    act(() => {
      setComposerDraft("thread-1", "");
    });
    expect(renderCount).toBe(mountRenderCount);

    act(() => {
      setComposerDraft("thread-1", "typed");
    });
    expect(result.current).toBe("typed");
  });

  it("switches the subscribed value when the thread key changes", () => {
    setComposerDraft("thread-1", "one");
    setComposerDraft("thread-2", "two");

    const { result, rerender } = renderHook(
      ({ threadId }: { threadId: string | null }) => useComposerDraft(threadId),
      { initialProps: { threadId: "thread-1" as string | null } },
    );
    expect(result.current).toBe("one");

    rerender({ threadId: "thread-2" });
    expect(result.current).toBe("two");

    rerender({ threadId: null });
    expect(result.current).toBe("");
  });
});
