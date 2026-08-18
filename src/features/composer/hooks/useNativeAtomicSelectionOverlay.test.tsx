// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { notifyProviderContinuationUiRollback } from "../../threads/services/providerContinuationRequests";
import { useNativeAtomicSelectionOverlay } from "./useNativeAtomicSelectionOverlay";

describe("useNativeAtomicSelectionOverlay", () => {
  it("clears overlay when continuation is cancelled", () => {
    const { result } = renderHook(() =>
      useNativeAtomicSelectionOverlay("thread-1::claude::local"),
    );

    act(() => {
      result.current[1]({
        modelCatalogEntryId: "clicked-model",
        model: "clicked-model",
      });
    });
    expect(result.current[0]).toEqual({
      modelCatalogEntryId: "clicked-model",
      model: "clicked-model",
    });

    act(() => {
      notifyProviderContinuationUiRollback({
        engine: "claude",
        providerProfileId: "k3",
      });
    });

    expect(result.current[0]).toBeNull();
  });

  it("clears overlay when the session/profile reset key changes", () => {
    const { result, rerender } = renderHook(
      ({ resetKey }) => useNativeAtomicSelectionOverlay(resetKey),
      { initialProps: { resetKey: "thread-1::claude::local" } },
    );

    act(() => {
      result.current[1]({
        modelCatalogEntryId: "clicked-model",
        model: "clicked-model",
      });
    });
    expect(result.current[0]).not.toBeNull();

    rerender({ resetKey: "thread-1::claude::k3" });
    expect(result.current[0]).toBeNull();
  });
});
