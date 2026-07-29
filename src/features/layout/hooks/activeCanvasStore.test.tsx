import { describe, expect, it, vi } from "vitest";

import {
  EMPTY_ACTIVE_CANVAS_SNAPSHOT,
  createActiveCanvasStore,
  shallowEqual,
  type ActiveCanvasSnapshot,
} from "./activeCanvasStore";

function snapshotOf(
  overrides: Partial<ActiveCanvasSnapshot>,
): ActiveCanvasSnapshot {
  return {
    ...EMPTY_ACTIVE_CANVAS_SNAPSHOT,
    ...overrides,
  };
}

describe("activeCanvasStore", () => {
  it("does not notify selector subscribers when the selected value is equal", () => {
    const store = createActiveCanvasStore(
      snapshotOf({
        threadId: "thread-1",
        isThinking: true,
      }),
    );
    const listener = vi.fn();

    store.subscribeSelector(
      (snapshot) => ({
        threadId: snapshot.threadId,
        isThinking: snapshot.isThinking,
      }),
      listener,
      shallowEqual,
    );

    store.setSnapshot(
      snapshotOf({
        threadId: "thread-1",
        isThinking: true,
        heartbeatPulse: 2,
      }),
    );

    expect(listener).not.toHaveBeenCalled();
  });

  it("notifies selector subscribers when the selected thread changes", () => {
    const store = createActiveCanvasStore(snapshotOf({ threadId: "thread-1" }));
    const listener = vi.fn();

    store.subscribeSelector((snapshot) => snapshot.threadId, listener);
    store.setSnapshot(snapshotOf({ threadId: "thread-2" }));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().threadId).toBe("thread-2");
  });

  it("does not notify Canvas for background binding-only updates", () => {
    const items: ActiveCanvasSnapshot["items"] = [
      { id: "m1", kind: "message", role: "assistant", text: "done" },
    ];
    const store = createActiveCanvasStore(
      snapshotOf({
        threadId: "shared:session-1",
        items,
      }),
    );
    const listener = vi.fn();

    store.subscribeSelector(
      (snapshot) => ({ threadId: snapshot.threadId, items: snapshot.items }),
      listener,
      shallowEqual,
    );
    store.setSnapshot(
      snapshotOf({
        threadId: "shared:session-1",
        items,
        threadStatusById: {
          "shared:background": {
            isProcessing: true,
            hasUnread: false,
            isReviewing: false,
            processingStartedAt: 1,
          },
        },
      }),
    );

    expect(listener).not.toHaveBeenCalled();
  });
});
