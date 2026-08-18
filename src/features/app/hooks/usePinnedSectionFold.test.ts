// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  getClientStoreSync,
  resetClientStorageForTests,
} from "../../../services/clientStorage";
import {
  PINNED_SECTION_FOLD_STORAGE_KEY,
  usePinnedSectionFold,
} from "./usePinnedSectionFold";

describe("usePinnedSectionFold", () => {
  beforeEach(() => {
    resetClientStorageForTests();
  });

  it("defaults to an expanded section and only the latest day", () => {
    const { result } = renderHook(() => usePinnedSectionFold());

    expect(result.current.isSectionExpanded).toBe(true);
    expect(result.current.isDayExpanded("2026-08-18", "2026-08-18")).toBe(true);
    expect(result.current.isDayExpanded("2026-08-17", "2026-08-18")).toBe(false);
  });

  it("persists section collapse", () => {
    const { result, unmount } = renderHook(() => usePinnedSectionFold());

    act(() => {
      result.current.toggleSection();
    });
    expect(result.current.isSectionExpanded).toBe(false);
    expect(
      getClientStoreSync("layout", PINNED_SECTION_FOLD_STORAGE_KEY),
    ).toMatchObject({ sectionExpanded: false });

    unmount();
    const remounted = renderHook(() => usePinnedSectionFold());
    expect(remounted.result.current.isSectionExpanded).toBe(false);
  });

  it("persists an older day expand and a latest-day collapse", () => {
    const { result } = renderHook(() => usePinnedSectionFold());

    act(() => {
      result.current.toggleDay("2026-08-17", "2026-08-18");
      result.current.toggleDay("2026-08-18", "2026-08-18");
    });

    expect(result.current.isDayExpanded("2026-08-17", "2026-08-18")).toBe(true);
    expect(result.current.isDayExpanded("2026-08-18", "2026-08-18")).toBe(false);
  });

  it("ensures the active day opens without collapsing the section", () => {
    const { result } = renderHook(() => usePinnedSectionFold());

    act(() => {
      result.current.ensureDayExpanded("2026-08-17", "2026-08-18");
    });

    expect(result.current.isSectionExpanded).toBe(true);
    expect(result.current.isDayExpanded("2026-08-17", "2026-08-18")).toBe(true);
  });
});
