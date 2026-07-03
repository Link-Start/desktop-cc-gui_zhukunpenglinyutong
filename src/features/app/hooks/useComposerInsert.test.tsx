// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useComposerInsert } from "./useComposerInsert";

describe("useComposerInsert", () => {
  it("applies consecutive inserts on latest text snapshot", () => {
    // 模拟生产接线:onDraftChange 同步写入草稿源,getDraftText 读到最新值。
    let draft = "";
    const onDraftChange = vi.fn((next: string) => {
      draft = next;
    });
    const textarea = document.createElement("textarea");
    const textareaRef = { current: textarea };

    const { result } = renderHook(() =>
      useComposerInsert({
        activeThreadId: "thread-1",
        getDraftText: () => draft,
        onDraftChange,
        textareaRef,
      }),
    );

    act(() => {
      result.current("first");
      result.current("second");
    });

    expect(onDraftChange).toHaveBeenNthCalledWith(1, "first");
    expect(onDraftChange).toHaveBeenNthCalledWith(2, "first second");
  });

  it("still updates draft when there is no active thread", () => {
    const onDraftChange = vi.fn();
    const textarea = document.createElement("textarea");
    const textareaRef = { current: textarea };

    const { result } = renderHook(() =>
      useComposerInsert({
        activeThreadId: null,
        getDraftText: () => "",
        onDraftChange,
        textareaRef,
      }),
    );

    act(() => {
      result.current("detached");
    });

    expect(onDraftChange).toHaveBeenCalledWith("detached");
  });
});
