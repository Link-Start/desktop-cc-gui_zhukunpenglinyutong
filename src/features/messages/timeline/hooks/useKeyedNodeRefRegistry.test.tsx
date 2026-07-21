// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useKeyedNodeRefRegistry } from "./useKeyedNodeRefRegistry";

describe("useKeyedNodeRefRegistry", () => {
  it("keeps the callback stable for an unchanged key while using the latest delegate", () => {
    const firstDelegate = vi.fn();
    const { result, rerender } = renderHook(
      ({ delegate }) => useKeyedNodeRefRegistry<HTMLDivElement>(delegate),
      { initialProps: { delegate: firstDelegate } },
    );
    const firstRef = result.current.getRef("message-1");
    const node = document.createElement("div");

    firstRef(node);
    expect(firstDelegate).toHaveBeenCalledWith("message-1", node);

    const nextDelegate = vi.fn();
    rerender({ delegate: nextDelegate });
    const nextRef = result.current.getRef("message-1");

    expect(nextRef).toBe(firstRef);
    nextRef(null);
    expect(nextDelegate).toHaveBeenCalledWith("message-1", null);
  });

  it("resynchronizes an already mounted node with the latest delegate", () => {
    const firstDelegate = vi.fn();
    const { result, rerender } = renderHook(
      ({ delegate }) => useKeyedNodeRefRegistry<HTMLDivElement>(delegate),
      { initialProps: { delegate: firstDelegate } },
    );
    const node = document.createElement("div");
    result.current.getRef("message-1")(node);

    const nextDelegate = vi.fn();
    rerender({ delegate: nextDelegate });
    result.current.syncMountedNodes();

    expect(nextDelegate).toHaveBeenCalledWith("message-1", node);
  });
});
