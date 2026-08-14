// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useComposerSelectionResolver } from "./composerSelectionResolver";

describe("useComposerSelectionResolver", () => {
  it("initializes the snapshot with all-null fields", () => {
    const { result } = renderHook(() => useComposerSelectionResolver());
    expect(result.current.resolveComposerSelection()).toEqual({
      id: null,
      model: null,
      source: null,
      providerProfileId: null,
      effort: null,
      collaborationMode: null,
    });
  });

  it("resolver reads the live ref (writer path stays ref-based)", () => {
    const { result } = renderHook(() => useComposerSelectionResolver());

    result.current.composerSelectionResolverRef.current = {
      id: "model-entry-1",
      model: "gpt-5",
      source: "catalog",
      providerProfileId: "profile-1",
      effort: "high",
      collaborationMode: { mode: "plan" },
    };

    expect(result.current.resolveComposerSelection()).toEqual({
      id: "model-entry-1",
      model: "gpt-5",
      source: "catalog",
      providerProfileId: "profile-1",
      effort: "high",
      collaborationMode: { mode: "plan" },
    });
  });

  it("keeps ref and resolver identity stable across rerenders", () => {
    const { result, rerender } = renderHook(() =>
      useComposerSelectionResolver(),
    );
    const refBefore = result.current.composerSelectionResolverRef;
    const resolverBefore = result.current.resolveComposerSelection;

    rerender();

    expect(result.current.composerSelectionResolverRef).toBe(refBefore);
    expect(result.current.resolveComposerSelection).toBe(resolverBefore);
  });
});
