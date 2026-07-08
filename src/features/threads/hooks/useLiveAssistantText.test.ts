// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useLiveAssistantText } from "./useLiveAssistantText";
import {
  appendLiveAssistantText,
  clearLiveAssistantText,
  resetLiveAssistantTextChannelForTests,
} from "../utils/liveAssistantTextChannel";

describe("useLiveAssistantText", () => {
  afterEach(() => {
    resetLiveAssistantTextChannelForTests();
  });

  it("streams channel updates into the subscribed row and falls back on clear", () => {
    const { result } = renderHook(() => useLiveAssistantText("t1", true));
    expect(result.current).toBeNull();

    act(() => {
      appendLiveAssistantText("t1", "item-1", "Hello");
    });
    expect(result.current?.text).toBe("Hello");

    act(() => {
      appendLiveAssistantText("t1", "item-1", " world");
    });
    expect(result.current?.text).toBe("Hello world");

    act(() => {
      clearLiveAssistantText("t1");
    });
    expect(result.current).toBeNull();
  });

  it("returns null and stays inert when disabled", () => {
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useLiveAssistantText("t1", enabled),
      { initialProps: { enabled: false } },
    );

    act(() => {
      appendLiveAssistantText("t1", "item-1", "ignored while disabled");
    });
    expect(result.current).toBeNull();

    // 行进入流式（enabled=true）后立刻读到通道快照。
    rerender({ enabled: true });
    expect(result.current?.text).toBe("ignored while disabled");
  });
});
