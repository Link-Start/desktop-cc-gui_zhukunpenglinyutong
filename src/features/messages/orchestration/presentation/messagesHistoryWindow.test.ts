// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../../types";
import {
  DEFAULT_HISTORY_WINDOW_SIZE,
  HISTORY_WINDOW_SIZE_FLAG_KEY,
  __resetHistoryWindowSizeCacheForTests,
  readHistoryWindowSize,
  resolveEarlierHistoryChip,
  resolveHistoryWindowCutIndex,
} from "./messagesHistoryWindow";

function userMessage(id: string, turnId?: string): ConversationItem {
  return {
    id,
    kind: "message",
    role: "user",
    text: `message ${id}`,
    ...(turnId ? { turnId } : {}),
  };
}

function assistantMessage(id: string, turnId?: string): ConversationItem {
  return {
    id,
    kind: "message",
    role: "assistant",
    text: `reply ${id}`,
    ...(turnId ? { turnId } : {}),
  };
}

describe("readHistoryWindowSize", () => {
  beforeEach(() => {
    window.localStorage.removeItem(HISTORY_WINDOW_SIZE_FLAG_KEY);
    __resetHistoryWindowSizeCacheForTests();
  });

  it("defaults to off (0) in test mode", () => {
    expect(readHistoryWindowSize()).toBe(0);
    expect(DEFAULT_HISTORY_WINDOW_SIZE).toBe(800);
  });

  it("reads a positive window size from localStorage", () => {
    window.localStorage.setItem(HISTORY_WINDOW_SIZE_FLAG_KEY, "150");
    expect(readHistoryWindowSize()).toBe(150);
  });

  it("treats zero / invalid values as off", () => {
    window.localStorage.setItem(HISTORY_WINDOW_SIZE_FLAG_KEY, "0");
    expect(readHistoryWindowSize()).toBe(0);
    window.localStorage.setItem(HISTORY_WINDOW_SIZE_FLAG_KEY, "-5");
    expect(readHistoryWindowSize()).toBe(0);
    window.localStorage.setItem(HISTORY_WINDOW_SIZE_FLAG_KEY, "abc");
    expect(readHistoryWindowSize()).toBe(0);
  });
});

describe("resolveHistoryWindowCutIndex", () => {
  it("returns 0 when the window flag is off", () => {
    const items = Array.from({ length: 500 }, (_, index) =>
      userMessage(`u-${index}`),
    );
    expect(
      resolveHistoryWindowCutIndex({
        items,
        windowSize: 0,
        revealedItemCount: 0,
        activeTurnId: null,
      }),
    ).toBe(0);
  });

  it("returns 0 when items fit within the window", () => {
    const items = Array.from({ length: 100 }, (_, index) =>
      userMessage(`u-${index}`),
    );
    expect(
      resolveHistoryWindowCutIndex({
        items,
        windowSize: 150,
        revealedItemCount: 0,
        activeTurnId: null,
      }),
    ).toBe(0);
  });

  it("collapses the oldest segment beyond the window", () => {
    const items = Array.from({ length: 500 }, (_, index) =>
      userMessage(`u-${index}`),
    );
    expect(
      resolveHistoryWindowCutIndex({
        items,
        windowSize: 150,
        revealedItemCount: 0,
        activeTurnId: null,
      }),
    ).toBe(350);
  });

  it("shrinks the cut as pages are revealed and reaches 0 when fully revealed", () => {
    const items = Array.from({ length: 500 }, (_, index) =>
      userMessage(`u-${index}`),
    );
    expect(
      resolveHistoryWindowCutIndex({
        items,
        windowSize: 150,
        revealedItemCount: 150,
        activeTurnId: null,
      }),
    ).toBe(200);
    expect(
      resolveHistoryWindowCutIndex({
        items,
        windowSize: 150,
        revealedItemCount: 350,
        activeTurnId: null,
      }),
    ).toBe(0);
  });

  it("pins the active turn: cut backs off to the turn head", () => {
    const items: ConversationItem[] = [
      ...Array.from({ length: 300 }, (_, index) => userMessage(`u-${index}`)),
      ...Array.from({ length: 193 }, (_, index) =>
        assistantMessage(`active-${index}`, "turn-active"),
      ),
    ];
    // 493 条总长，窗口 150 → 初始 cut=343 会裁掉 active turn 头部 → 回退到段首 300
    expect(
      resolveHistoryWindowCutIndex({
        items,
        windowSize: 150,
        revealedItemCount: 0,
        activeTurnId: "turn-active",
      }),
    ).toBe(300);
  });

  it("never splits a turn run across the cut boundary", () => {
    const items: ConversationItem[] = [
      ...Array.from({ length: 200 }, (_, index) => userMessage(`u-${index}`)),
      userMessage("t1-user", "turn-1"),
      assistantMessage("t1-a1", "turn-1"),
      assistantMessage("t1-a2", "turn-1"),
      ...Array.from({ length: 150 }, (_, index) =>
        assistantMessage(`tail-${index}`),
      ),
    ];
    // 总长 353，窗口 152 → cut=201，恰好落在 turn-1（200..202）中间 → 回退到段首 200
    expect(
      resolveHistoryWindowCutIndex({
        items,
        windowSize: 152,
        revealedItemCount: 0,
        activeTurnId: null,
      }),
    ).toBe(200);
  });

  it("stops turn retreat at maxDisplayed unless the active turn is pinned", () => {
    const items: ConversationItem[] = Array.from({ length: 2000 }, (_, index) =>
      assistantMessage(`mega-${index}`, "mega-turn"),
    );
    expect(
      resolveHistoryWindowCutIndex({
        items,
        windowSize: 300,
        revealedItemCount: 0,
        activeTurnId: null,
        maxDisplayed: 400,
      }),
    ).toBe(1600);
    expect(
      resolveHistoryWindowCutIndex({
        items,
        windowSize: 300,
        revealedItemCount: 0,
        activeTurnId: "mega-turn",
        maxDisplayed: 400,
      }),
    ).toBe(0);
  });

  it("keeps a prepended page inside the window when reveal budget is retained", () => {
    const items: ConversationItem[] = Array.from({ length: 880 }, (_, index) =>
      assistantMessage(`row-${index}`),
    );
    expect(
      resolveHistoryWindowCutIndex({
        items,
        windowSize: 800,
        revealedItemCount: 80,
        activeTurnId: null,
      }),
    ).toBe(0);
    expect(
      resolveHistoryWindowCutIndex({
        items,
        windowSize: 800,
        revealedItemCount: 0,
        activeTurnId: null,
      }),
    ).toBe(80);
  });

  it("still retreats a small turn that stays within maxDisplayed", () => {
    const items: ConversationItem[] = [
      ...Array.from({ length: 250 }, (_, index) => userMessage(`u-${index}`)),
      ...Array.from({ length: 20 }, (_, index) =>
        assistantMessage(`turn-${index}`, "turn-cut"),
      ),
      ...Array.from({ length: 290 }, (_, index) =>
        assistantMessage(`tail-${index}`),
      ),
    ];
    expect(
      resolveHistoryWindowCutIndex({
        items,
        windowSize: 300,
        revealedItemCount: 0,
        activeTurnId: null,
        maxDisplayed: 400,
      }),
    ).toBe(250);
  });
});

describe("resolveEarlierHistoryChip", () => {
  it("shows an uncounted chip when only disk hasMore is true", () => {
    expect(
      resolveEarlierHistoryChip({
        knownCollapsedCount: 0,
        diskHistoryHasMore: true,
      }),
    ).toEqual({
      visible: true,
      hasUncountedEarlierHistory: true,
      countedCount: 0,
    });
  });

  it("keeps the counted copy when local remainder is known", () => {
    expect(
      resolveEarlierHistoryChip({
        knownCollapsedCount: 12,
        diskHistoryHasMore: true,
      }),
    ).toEqual({
      visible: true,
      hasUncountedEarlierHistory: false,
      countedCount: 12,
    });
  });

  it("hides the chip when nothing older remains", () => {
    expect(
      resolveEarlierHistoryChip({
        knownCollapsedCount: 0,
        diskHistoryHasMore: false,
      }),
    ).toEqual({
      visible: false,
      hasUncountedEarlierHistory: false,
      countedCount: 0,
    });
  });
});


