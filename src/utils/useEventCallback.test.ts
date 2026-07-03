// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useEventCallback } from "./useEventCallback";

describe("useEventCallback", () => {
  it("keeps a stable identity across re-renders", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: number }) => useEventCallback(() => value),
      { initialProps: { value: 1 } },
    );
    const first = result.current;
    rerender({ value: 2 });
    expect(result.current).toBe(first);
  });

  it("always invokes the latest closure", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: number }) => useEventCallback(() => value),
      { initialProps: { value: 1 } },
    );
    const stable = result.current;
    rerender({ value: 42 });
    let observed = 0;
    act(() => {
      observed = stable();
    });
    expect(observed).toBe(42);
  });

  it("forwards arguments", () => {
    const { result } = renderHook(() =>
      useEventCallback((a: number, b: number) => a + b),
    );
    expect(result.current(2, 3)).toBe(5);
  });
});
