// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useOpenCodeThreadBinding } from "./useOpenCodeThreadBinding";

describe("useOpenCodeThreadBinding", () => {
  it("syncs and resolves selections for the active thread", () => {
    const syncActiveOpenCodeThread = vi.fn();
    const resolveOpenCodeAgentForThread = vi.fn(() => "agent-a");
    const resolveOpenCodeVariantForThread = vi.fn(() => "high");
    const selectOpenCodeAgentForThread = vi.fn();
    const selectOpenCodeVariantForThread = vi.fn();

    const { result } = renderHook(() =>
      useOpenCodeThreadBinding({
        activeThreadId: "opencode:thread-1",
        resolveOpenCodeAgentForThread,
        resolveOpenCodeVariantForThread,
        selectOpenCodeAgentForThread,
        selectOpenCodeVariantForThread,
        syncActiveOpenCodeThread,
      }),
    );

    expect(syncActiveOpenCodeThread).toHaveBeenCalledWith("opencode:thread-1");
    expect(resolveOpenCodeAgentForThread).toHaveBeenCalledWith("opencode:thread-1");
    expect(resolveOpenCodeVariantForThread).toHaveBeenCalledWith(
      "opencode:thread-1",
    );
    expect(result.current.selectedOpenCodeAgent).toBe("agent-a");
    expect(result.current.selectedOpenCodeVariant).toBe("high");

    act(() => {
      result.current.handleSelectOpenCodeAgent("agent-b");
      result.current.handleSelectOpenCodeVariant("max");
    });

    expect(selectOpenCodeAgentForThread).toHaveBeenCalledWith(
      "opencode:thread-1",
      "agent-b",
    );
    expect(selectOpenCodeVariantForThread).toHaveBeenCalledWith(
      "opencode:thread-1",
      "max",
    );
  });

  it("rebinds selection callbacks when the active thread changes", () => {
    const selectOpenCodeAgentForThread = vi.fn();
    const view = renderHook(
      ({ activeThreadId }) =>
        useOpenCodeThreadBinding({
          activeThreadId,
          resolveOpenCodeAgentForThread: vi.fn(() => null),
          resolveOpenCodeVariantForThread: vi.fn(() => null),
          selectOpenCodeAgentForThread,
          selectOpenCodeVariantForThread: vi.fn(),
          syncActiveOpenCodeThread: vi.fn(),
        }),
      { initialProps: { activeThreadId: "opencode:thread-1" } },
    );

    view.rerender({ activeThreadId: "opencode:thread-2" });
    act(() => {
      view.result.current.handleSelectOpenCodeAgent("agent-b");
    });

    expect(selectOpenCodeAgentForThread).toHaveBeenLastCalledWith(
      "opencode:thread-2",
      "agent-b",
    );
  });
});
