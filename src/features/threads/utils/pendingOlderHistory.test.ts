import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../types";
import {
  clearPendingOlderHistory,
  getPendingOlderHistory,
  getPendingOlderHistoryRemainingCount,
  hasPendingOlderHistory,
  rememberFullHistoryForWindow,
  replacePendingOlderHistoryItems,
  takeAllRemainingOlderHistory,
  takeNextOlderHistoryBatch,
} from "./pendingOlderHistory";

function makeItems(count: number): ConversationItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index}`,
    kind: "message" as const,
    role: "assistant" as const,
    text: `msg-${index}`,
  }));
}

describe("pendingOlderHistory", () => {
  it("remembers hidden older items and prepends them oldest-last", () => {
    const items = makeItems(25);
    rememberFullHistoryForWindow("shared:1", items, 10);
    expect(hasPendingOlderHistory("shared:1")).toBe(true);
    expect(getPendingOlderHistoryRemainingCount("shared:1")).toBe(15);

    const first = takeNextOlderHistoryBatch("shared:1", 10);
    expect(first.map((item) => item.id)).toEqual(
      items.slice(5, 15).map((item) => item.id),
    );
    expect(hasPendingOlderHistory("shared:1")).toBe(true);

    const second = takeNextOlderHistoryBatch("shared:1", 10);
    expect(second.map((item) => item.id)).toEqual(
      items.slice(0, 5).map((item) => item.id),
    );
    expect(hasPendingOlderHistory("shared:1")).toBe(false);
    clearPendingOlderHistory("shared:1");
  });

  it("replaces the cached snapshot while keeping a tail window", () => {
    const original = makeItems(20);
    rememberFullHistoryForWindow("shared:2", original, 8);
    const merged = [
      ...makeItems(4).map((item, index) => ({
        ...item,
        id: `extra-${index}`,
      })),
      ...original,
    ];
    const pending = replacePendingOlderHistoryItems("shared:2", merged);
    expect(pending?.displayedCount).toBeGreaterThanOrEqual(8);
    expect(getPendingOlderHistory("shared:2")?.items).toHaveLength(merged.length);
    clearPendingOlderHistory("shared:2");
  });

  it("defaults the paged helper to 500 items", () => {
    const items = makeItems(900);
    rememberFullHistoryForWindow("shared:page", items, 300);
    const first = takeNextOlderHistoryBatch("shared:page");
    expect(first).toHaveLength(500);
    expect(first.map((item) => item.id)).toEqual(
      items.slice(100, 600).map((item) => item.id),
    );
    expect(getPendingOlderHistoryRemainingCount("shared:page")).toBe(100);
    clearPendingOlderHistory("shared:page");
  });

  it("drains every remaining older item when asked", () => {
    const items = makeItems(900);
    rememberFullHistoryForWindow("shared:all", items, 300);
    const all = takeAllRemainingOlderHistory("shared:all");
    expect(all).toHaveLength(600);
    expect(all.map((item) => item.id)).toEqual(
      items.slice(0, 600).map((item) => item.id),
    );
    expect(hasPendingOlderHistory("shared:all")).toBe(false);
    clearPendingOlderHistory("shared:all");
  });
});
