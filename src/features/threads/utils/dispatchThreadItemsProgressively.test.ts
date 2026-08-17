import { describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../types";
import {
  dispatchThreadItemsProgressively,
  THREAD_ITEMS_FIRST_PAINT_COUNT,
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
});
