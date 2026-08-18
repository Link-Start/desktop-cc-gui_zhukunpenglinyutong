import { describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../types";
import { DEFAULT_HISTORY_WINDOW_SIZE } from "../../messages/orchestration/presentation/messagesHistoryWindow";
import { CLAUDE_UI_HISTORY_WINDOW } from "../loaders/claudeHistoryLoader";
import {
  dispatchThreadItemsProgressively,
  OLDER_HISTORY_REVEAL_PAGE_SIZE,
  THREAD_ITEMS_FIRST_PAINT_COUNT,
  THREAD_ITEMS_FIRST_PAINT_MAX_DISPLAYED,
  THREAD_ITEMS_PROGRESSIVE_BATCH_SIZE,
} from "./dispatchThreadItemsProgressively";

function makeItems(count: number): ConversationItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index}`,
    kind: "message" as const,
    role: "assistant" as const,
    text: `msg-${index}`,
  }));
}

describe("dispatchThreadItemsProgressively", () => {
  it("dispatches once when item count is within the first-paint window", async () => {
    const dispatch = vi.fn();
    const items = makeItems(THREAD_ITEMS_FIRST_PAINT_COUNT);
    const result = await dispatchThreadItemsProgressively(dispatch, "grok:1", items, {
      yieldBetweenBatches: async () => {},
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadItems",
      threadId: "grok:1",
      items,
    });
    expect(result).toEqual({
      displayedCount: items.length,
      remainingOlderCount: 0,
    });
  });

  it("keeps a first-paint tail plus older chip when history exceeds the window", async () => {
    const dispatch = vi.fn();
    const overflow = 45;
    const items = makeItems(THREAD_ITEMS_FIRST_PAINT_COUNT + overflow);
    const result = await dispatchThreadItemsProgressively(dispatch, "claude:1", items, {
      yieldBetweenBatches: async () => {},
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
    const first = dispatch.mock.calls[0]?.[0] as {
      items: ConversationItem[];
    };
    expect(first.items).toHaveLength(THREAD_ITEMS_FIRST_PAINT_COUNT);
    expect(first.items[0]?.id).toBe(
      items[items.length - THREAD_ITEMS_FIRST_PAINT_COUNT]?.id,
    );
    expect(result).toEqual({
      displayedCount: THREAD_ITEMS_FIRST_PAINT_COUNT,
      remainingOlderCount: overflow,
    });
  });

  it("first-paints the newest window instead of the oldest prefix", async () => {
    const dispatch = vi.fn();
    const items = makeItems(THREAD_ITEMS_PROGRESSIVE_BATCH_SIZE * 2 + 5);
    const result = await dispatchThreadItemsProgressively(dispatch, "grok:big", items, {
      batchSize: 10,
      yieldBetweenBatches: async () => {},
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
    const first = dispatch.mock.calls[0]?.[0] as {
      items: ConversationItem[];
    };
    expect(first.items).toHaveLength(10);
    expect(first.items[0]?.id).toBe(items[items.length - 10]?.id);
    expect(first.items[first.items.length - 1]?.id).toBe(
      items[items.length - 1]?.id,
    );
    expect(result).toEqual({
      displayedCount: 10,
      remainingOlderCount: items.length - 10,
    });
  });

  it("writes the full list once in atomic mode", async () => {
    const dispatch = vi.fn();
    const items = makeItems(40);
    const result = await dispatchThreadItemsProgressively(dispatch, "shared:1", items, {
      batchSize: 10,
      mode: "atomic",
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadItems",
      threadId: "shared:1",
      items,
    });
    expect(result.remainingOlderCount).toBe(0);
  });

  it("stops before writing when shouldContinue returns false", async () => {
    const dispatch = vi.fn();
    const items = makeItems(50);
    await dispatchThreadItemsProgressively(dispatch, "grok:abort", items, {
      batchSize: 10,
      shouldContinue: () => false,
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("retreats the first-paint cut to the turn start instead of splitting a turn", async () => {
    const prefix = makeItems(250);
    const turnItems: ConversationItem[] = Array.from({ length: 20 }, (_, index) => ({
      id: `turn-item-${index}`,
      kind: "message" as const,
      role: "assistant" as const,
      text: `turn-${index}`,
      turnId: "turn-cut",
    }));
    const tail = Array.from({ length: 290 }, (_, index) => ({
      id: `tail-${index}`,
      kind: "message" as const,
      role: "assistant" as const,
      text: `tail-${index}`,
    }));
    const items = [...prefix, ...turnItems, ...tail];
    const dispatch = vi.fn();

    const result = await dispatchThreadItemsProgressively(
      dispatch,
      "claude:turn-cut",
      items,
      { batchSize: THREAD_ITEMS_FIRST_PAINT_COUNT },
    );

    const first = dispatch.mock.calls[0]?.[0] as { items: ConversationItem[] };
    expect(first.items[0]?.id).toBe("turn-item-0");
    expect(first.items.length).toBeGreaterThan(THREAD_ITEMS_FIRST_PAINT_COUNT);
    expect(result.remainingOlderCount).toBe(250);
    expect(result.displayedCount).toBe(items.length - 250);
    expect(first.items.length).toBeLessThanOrEqual(
      THREAD_ITEMS_FIRST_PAINT_MAX_DISPLAYED,
    );
  });

  it("caps first-paint when a mega-turn would otherwise expand to the full transcript", async () => {
    const items: ConversationItem[] = Array.from({ length: 2000 }, (_, index) => ({
      id: `mega-${index}`,
      kind: "message" as const,
      role: "assistant" as const,
      text: `mega-${index}`,
      turnId: "one-giant-turn",
    }));
    const dispatch = vi.fn();
    const result = await dispatchThreadItemsProgressively(
      dispatch,
      "claude:mega",
      items,
    );
    const first = dispatch.mock.calls[0]?.[0] as { items: ConversationItem[] };
    expect(first.items).toHaveLength(THREAD_ITEMS_FIRST_PAINT_MAX_DISPLAYED);
    expect(first.items[0]?.id).toBe(
      items[items.length - THREAD_ITEMS_FIRST_PAINT_MAX_DISPLAYED]?.id,
    );
    expect(result).toEqual({
      displayedCount: THREAD_ITEMS_FIRST_PAINT_MAX_DISPLAYED,
      remainingOlderCount: items.length - THREAD_ITEMS_FIRST_PAINT_MAX_DISPLAYED,
    });
  });

  it("writes a medium transcript in one shot without pending older history", async () => {
    const items = makeItems(250);
    const dispatch = vi.fn();
    const result = await dispatchThreadItemsProgressively(
      dispatch,
      "claude:medium",
      items,
    );
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadItems",
      threadId: "claude:medium",
      items,
    });
    expect(result).toEqual({
      displayedCount: 250,
      remainingOlderCount: 0,
    });
  });

  it("keeps first-paint / reveal / progressive constants decoupled", () => {
    expect(THREAD_ITEMS_FIRST_PAINT_COUNT).toBe(300);
    expect(THREAD_ITEMS_FIRST_PAINT_MAX_DISPLAYED).toBe(400);
    expect(THREAD_ITEMS_PROGRESSIVE_BATCH_SIZE).toBe(800);
    expect(DEFAULT_HISTORY_WINDOW_SIZE).toBe(800);
    expect(OLDER_HISTORY_REVEAL_PAGE_SIZE).toBe(500);
    expect(CLAUDE_UI_HISTORY_WINDOW).toBe(80);
  });
});
