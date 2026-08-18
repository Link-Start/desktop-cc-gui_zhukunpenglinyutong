import { afterEach, describe, expect, it } from "vitest";
import {
  getThreadDiskHistoryWindow,
  hasThreadDiskHistoryMore,
  publishThreadDiskHistoryWindows,
  resetThreadDiskHistoryWindowsForTests,
  subscribeThreadDiskHistoryWindows,
} from "./threadDiskHistoryWindowStore";

describe("threadDiskHistoryWindowStore", () => {
  afterEach(() => {
    resetThreadDiskHistoryWindowsForTests();
  });

  it("treats a real disk cursor as consumable remainder", () => {
    publishThreadDiskHistoryWindows({
      "claude:sess": { hasMore: true, nextCursor: "80" },
    });
    expect(hasThreadDiskHistoryMore("claude:sess")).toBe(true);
    expect(getThreadDiskHistoryWindow("claude:sess")).toEqual({
      hasMore: true,
      nextCursor: "80",
    });
  });

  it("does not treat a memory cursor as disk remainder", () => {
    publishThreadDiskHistoryWindows({
      "claude:sess": { hasMore: true, nextCursor: "memory" },
    });
    expect(hasThreadDiskHistoryMore("claude:sess")).toBe(false);
  });

  it("hides the remainder when hasMore is false", () => {
    publishThreadDiskHistoryWindows({
      "claude:sess": { hasMore: false, nextCursor: null },
    });
    expect(hasThreadDiskHistoryMore("claude:sess")).toBe(false);
  });

  it("notifies subscribers when the window map is replaced", () => {
    const seen: boolean[] = [];
    const unsubscribe = subscribeThreadDiskHistoryWindows(() => {
      seen.push(hasThreadDiskHistoryMore("claude:sess"));
    });
    publishThreadDiskHistoryWindows({
      "claude:sess": { hasMore: true, nextCursor: "40" },
    });
    publishThreadDiskHistoryWindows({
      "claude:sess": { hasMore: false, nextCursor: null },
    });
    unsubscribe();
    expect(seen).toEqual([true, false]);
  });
});
