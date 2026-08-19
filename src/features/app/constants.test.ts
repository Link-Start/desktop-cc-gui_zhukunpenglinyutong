import { describe, expect, it } from "vitest";
import {
  DEFAULT_VISIBLE_THREAD_ROOT_COUNT,
  normalizeVisibleThreadRootCount,
  planThreadListPageAdvance,
  resolveVisibleThreadRootLimit,
} from "./constants";

describe("visible thread root paging", () => {
  it("defaults the first-paint page size to 12", () => {
    expect(DEFAULT_VISIBLE_THREAD_ROOT_COUNT).toBe(12);
    expect(normalizeVisibleThreadRootCount(undefined)).toBe(12);
    expect(normalizeVisibleThreadRootCount(null)).toBe(12);
  });

  it("raises the visible cap as 12, 24, 36, 48", () => {
    expect(resolveVisibleThreadRootLimit(12, 1)).toBe(12);
    expect(resolveVisibleThreadRootLimit(12, 2)).toBe(24);
    expect(resolveVisibleThreadRootLimit(12, 3)).toBe(36);
    expect(resolveVisibleThreadRootLimit(12, 4)).toBe(48);
  });

  it("uses the workspace page size when paging", () => {
    expect(resolveVisibleThreadRootLimit(8, 3)).toBe(24);
  });

  it("treats missing or invalid pages as the first page", () => {
    expect(resolveVisibleThreadRootLimit(12, undefined)).toBe(12);
    expect(resolveVisibleThreadRootLimit(12, 0)).toBe(12);
    expect(resolveVisibleThreadRootLimit(12, Number.NaN)).toBe(12);
  });

  it("consumes the in-memory page before fetching", () => {
    expect(
      planThreadListPageAdvance({
        totalRoots: 24,
        currentLimit: 12,
        nextCursor: "session-index::next",
        isPaging: false,
      }),
    ).toEqual({ advance: true, fetch: false });
  });

  it("fetches only after the in-memory page is exhausted", () => {
    expect(
      planThreadListPageAdvance({
        totalRoots: 12,
        currentLimit: 12,
        nextCursor: "session-index::next",
        isPaging: false,
      }),
    ).toEqual({ advance: true, fetch: true });
  });

  it("does not raise the cap or fetch without a remaining page", () => {
    expect(
      planThreadListPageAdvance({
        totalRoots: 12,
        currentLimit: 12,
        nextCursor: null,
        isPaging: false,
      }),
    ).toEqual({ advance: false, fetch: false });
  });

  it("ignores more-clicks while a page request is in flight", () => {
    expect(
      planThreadListPageAdvance({
        totalRoots: 12,
        currentLimit: 12,
        nextCursor: "session-index::next",
        isPaging: true,
      }),
    ).toEqual({ advance: false, fetch: false });
  });
});
