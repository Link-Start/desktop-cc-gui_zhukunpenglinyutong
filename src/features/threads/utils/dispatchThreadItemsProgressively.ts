import type { ConversationItem } from "../../../types";

/** Default batch size for progressive history hydration into the thread store. */
export const THREAD_ITEMS_PROGRESSIVE_BATCH_SIZE = 80;

export type ThreadItemsDispatch = (action: {
  type: "setThreadItems";
  threadId: string;
  items: ConversationItem[];
}) => void;

export type DispatchThreadItemsProgressivelyOptions = {
  /** Items per paint. Defaults to {@link THREAD_ITEMS_PROGRESSIVE_BATCH_SIZE}. */
  batchSize?: number;
  /**
   * Yield between batches so the browser can paint. Defaults to a macrotask
   * (`setTimeout(0)`). Tests may pass a no-op or resolved promise.
   */
  yieldBetweenBatches?: () => Promise<void>;
  /** Abort progressive expansion when the resume request is superseded. */
  shouldContinue?: () => boolean;
};

function defaultYieldBetweenBatches(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/**
 * Dispatch history items into the thread store without one multi-thousand-item
 * main-thread commit. Small lists use a single `setThreadItems`; large lists
 * paint the newest window first, then prepend older batches.
 */
export async function dispatchThreadItemsProgressively(
  dispatch: ThreadItemsDispatch,
  threadId: string,
  items: ConversationItem[],
  options?: DispatchThreadItemsProgressivelyOptions,
): Promise<void> {
  const batchSize = Math.max(
    1,
    options?.batchSize ?? THREAD_ITEMS_PROGRESSIVE_BATCH_SIZE,
  );
  const yieldBetweenBatches =
    options?.yieldBetweenBatches ?? defaultYieldBetweenBatches;
  const shouldContinue = options?.shouldContinue ?? (() => true);

  if (items.length === 0) {
    return;
  }

  if (items.length <= batchSize) {
    if (!shouldContinue()) {
      return;
    }
    dispatch({ type: "setThreadItems", threadId, items });
    return;
  }

  let visible = batchSize;
  while (true) {
    if (!shouldContinue()) {
      return;
    }
    const start = Math.max(0, items.length - visible);
    dispatch({
      type: "setThreadItems",
      threadId,
      items: items.slice(start),
    });
    if (start === 0) {
      return;
    }
    await yieldBetweenBatches();
    visible = Math.min(visible + batchSize, items.length);
  }
}
