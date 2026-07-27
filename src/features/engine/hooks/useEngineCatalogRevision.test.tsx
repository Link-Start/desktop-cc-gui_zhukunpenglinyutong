// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "../../composer/types/provider";
import { useEngineCatalogRevision } from "./useEngineCatalogRevision";

describe("useEngineCatalogRevision", () => {
  it("updates only for catalog keys and removes listeners on unmount", () => {
    const removeEventListener = vi.spyOn(window, "removeEventListener");
    const { result, unmount } = renderHook(() => useEngineCatalogRevision());

    act(() => {
      window.dispatchEvent(
        new CustomEvent("localStorageChange", {
          detail: { key: "unrelated" },
        }),
      );
    });
    expect(result.current).toBe(0);

    act(() => {
      window.dispatchEvent(
        new CustomEvent("localStorageChange", {
          detail: { key: STORAGE_KEYS.CLAUDE_CUSTOM_MODELS },
        }),
      );
    });
    expect(result.current).toBe(1);

    unmount();
    expect(removeEventListener).toHaveBeenCalledWith(
      "localStorageChange",
      expect.any(Function),
    );
  });
});
