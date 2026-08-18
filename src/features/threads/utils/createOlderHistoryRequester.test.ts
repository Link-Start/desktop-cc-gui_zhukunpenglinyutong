import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../types";
import { createOlderHistoryRequester } from "./createOlderHistoryRequester";
import {
  clearPendingOlderHistory,
  rememberFullHistoryForWindow,
} from "./pendingOlderHistory";

const THREAD_ID = "claude:sess";

function userMessage(id: string): ConversationItem {
  return {
    id,
    kind: "message",
    role: "user",
    text: `message ${id}`,
  };
}

function createHarness(options?: {
  window?: { hasMore: boolean; nextCursor: string | null };
  epoch?: number;
  loadPage?: ReturnType<typeof vi.fn>;
}) {
  const actions: Array<{ type: string; threadId: string }> = [];
  const dispatched: unknown[] = [];
  const inFlightByThread = new Map<
    string,
    { cursor: string; epoch: number }
  >();
  let epoch = options?.epoch ?? 0;
  const beforePrepend: Array<{
    threadId: string;
    prependedCount?: number;
  }> = [];
  const loadPage =
    options?.loadPage ??
    vi.fn().mockResolvedValue({
      items: [userMessage("older-1")],
      hasMore: true,
      nextCursor: "40",
    });

  const requester = createOlderHistoryRequester({
    dispatch: (action) => {
      dispatched.push(action);
      actions.push({ type: action.type, threadId: action.threadId });
    },
    getHistoryWindow: () => options?.window,
    resolveWorkspace: () => ({
      workspaceId: "ws-1",
      workspacePath: "/tmp/ws",
    }),
    getDiskPageEpoch: () => epoch,
    inFlightByThread,
    loadPage,
    notifyBeforePrepend: (threadId, detail) => {
      beforePrepend.push({
        threadId,
        prependedCount: detail?.prependedCount,
      });
    },
  });

  return {
    requester,
    dispatched,
    actions,
    inFlightByThread,
    loadPage,
    beforePrepend,
    cancel: () => {
      epoch += 1;
      inFlightByThread.delete(THREAD_ID);
    },
  };
}

describe("createOlderHistoryRequester", () => {
  afterEach(() => {
    clearPendingOlderHistory(THREAD_ID);
  });

  it("drains memory pending before any disk before request", () => {
    rememberFullHistoryForWindow(
      THREAD_ID,
      [userMessage("old"), userMessage("mid"), userMessage("new")],
      1,
    );
    const harness = createHarness({
      window: { hasMore: true, nextCursor: "80" },
    });

    expect(harness.requester(THREAD_ID)).toBe(true);
    expect(harness.loadPage).not.toHaveBeenCalled();
    expect(harness.dispatched).toEqual([
      {
        type: "prependThreadItems",
        threadId: THREAD_ID,
        items: [userMessage("old"), userMessage("mid")],
      },
      {
        type: "setThreadHistoryWindow",
        threadId: THREAD_ID,
        hasMore: true,
        nextCursor: "80",
      },
    ]);
    expect(harness.beforePrepend).toEqual([
      { threadId: THREAD_ID, prependedCount: 2 },
    ]);
  });

  it("prepends one viewport page of memory pending, not the full remainder", () => {
    const items = Array.from({ length: 1200 }, (_, index) =>
      userMessage(`hist-${index}`),
    );
    rememberFullHistoryForWindow(THREAD_ID, items, 300);
    const harness = createHarness({
      window: { hasMore: false, nextCursor: null },
    });

    expect(harness.requester(THREAD_ID)).toBe(true);
    expect(harness.loadPage).not.toHaveBeenCalled();
    const prepend = harness.dispatched[0] as {
      type: string;
      items: ConversationItem[];
    };
    expect(prepend.type).toBe("prependThreadItems");
    expect(prepend.items).toHaveLength(500);
    expect(prepend.items[0]?.id).toBe("hist-400");
    expect(prepend.items[499]?.id).toBe("hist-899");
    expect(harness.beforePrepend).toEqual([
      { threadId: THREAD_ID, prependedCount: 500 },
    ]);
    expect(harness.dispatched[1]).toEqual({
      type: "setThreadHistoryWindow",
      threadId: THREAD_ID,
      hasMore: true,
      nextCursor: "memory",
    });
  });

  it("drains every remaining memory item when All is requested", () => {
    const items = Array.from({ length: 1200 }, (_, index) =>
      userMessage(`hist-${index}`),
    );
    rememberFullHistoryForWindow(THREAD_ID, items, 300);
    const harness = createHarness({
      window: { hasMore: true, nextCursor: "80" },
    });

    expect(harness.requester(THREAD_ID, { drainAll: true })).toBe(true);
    expect(harness.loadPage).not.toHaveBeenCalled();
    const prepend = harness.dispatched[0] as {
      type: string;
      items: ConversationItem[];
    };
    expect(prepend.items).toHaveLength(900);
    expect(prepend.items[0]?.id).toBe("hist-0");
    expect(prepend.items[899]?.id).toBe("hist-899");
    expect(harness.dispatched[1]).toEqual({
      type: "setThreadHistoryWindow",
      threadId: THREAD_ID,
      hasMore: true,
      nextCursor: "80",
    });
  });

  it("does not start a disk page when All finds no memory remainder", () => {
    const harness = createHarness({
      window: { hasMore: true, nextCursor: "80" },
    });

    expect(harness.requester(THREAD_ID, { drainAll: true })).toBe(false);
    expect(harness.loadPage).not.toHaveBeenCalled();
    expect(harness.dispatched).toEqual([]);
  });

  it("loads the previous disk page when pending is empty", async () => {
    const harness = createHarness({
      window: { hasMore: true, nextCursor: "80" },
    });

    expect(harness.requester(THREAD_ID)).toBe(true);
    expect(harness.loadPage).toHaveBeenCalledWith({
      threadId: THREAD_ID,
      workspaceId: "ws-1",
      workspacePath: "/tmp/ws",
      before: "80",
      limit: 80,
    });
    await vi.waitFor(() => {
      expect(harness.actions.map((action) => action.type)).toEqual([
        "prependThreadItems",
        "setThreadHistoryWindow",
      ]);
    });
    expect(harness.beforePrepend).toEqual([
      { threadId: THREAD_ID, prependedCount: 1 },
    ]);
    expect(harness.dispatched[0]).toEqual({
      type: "prependThreadItems",
      threadId: THREAD_ID,
      items: [userMessage("older-1")],
    });
    expect(harness.dispatched[1]).toEqual({
      type: "setThreadHistoryWindow",
      threadId: THREAD_ID,
      hasMore: true,
      nextCursor: "40",
    });
    expect(harness.inFlightByThread.has(THREAD_ID)).toBe(false);
  });

  it("rejects a second click for the same in-flight cursor", async () => {
    let resolvePage: ((value: {
      items: ConversationItem[];
      hasMore: boolean;
      nextCursor: string | null;
    }) => void) | undefined;
    const loadPage = vi.fn(
      () =>
        new Promise<{
          items: ConversationItem[];
          hasMore: boolean;
          nextCursor: string | null;
        }>((resolve) => {
          resolvePage = resolve;
        }),
    );
    const harness = createHarness({
      window: { hasMore: true, nextCursor: "80" },
      loadPage,
    });

    expect(harness.requester(THREAD_ID)).toBe(true);
    expect(harness.requester(THREAD_ID)).toBe(false);
    expect(loadPage).toHaveBeenCalledTimes(1);
    resolvePage?.({
      items: [userMessage("older-1")],
      hasMore: false,
      nextCursor: null,
    });
    await vi.waitFor(() => {
      expect(harness.inFlightByThread.has(THREAD_ID)).toBe(false);
    });
  });

  it("drops a late page after the thread is cancelled", async () => {
    let resolvePage: ((value: {
      items: ConversationItem[];
      hasMore: boolean;
      nextCursor: string | null;
    }) => void) | undefined;
    const loadPage = vi.fn(
      () =>
        new Promise<{
          items: ConversationItem[];
          hasMore: boolean;
          nextCursor: string | null;
        }>((resolve) => {
          resolvePage = resolve;
        }),
    );
    const harness = createHarness({
      window: { hasMore: true, nextCursor: "80" },
      loadPage,
    });

    expect(harness.requester(THREAD_ID)).toBe(true);
    harness.cancel();
    resolvePage?.({
      items: [userMessage("stale")],
      hasMore: true,
      nextCursor: "40",
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(harness.dispatched).toEqual([]);
  });

  it("keeps hasMore after a failed page so the same cursor can retry", async () => {
    const loadPage = vi
      .fn()
      .mockRejectedValueOnce(new Error("disk unavailable"))
      .mockResolvedValueOnce({
        items: [userMessage("older-1")],
        hasMore: false,
        nextCursor: null,
      });
    const harness = createHarness({
      window: { hasMore: true, nextCursor: "80" },
      loadPage,
    });

    expect(harness.requester(THREAD_ID)).toBe(true);
    await vi.waitFor(() => {
      expect(harness.inFlightByThread.has(THREAD_ID)).toBe(false);
    });
    expect(harness.dispatched).toEqual([]);

    expect(harness.requester(THREAD_ID)).toBe(true);
    await vi.waitFor(() => {
      expect(harness.actions).toContainEqual({
        type: "setThreadHistoryWindow",
        threadId: THREAD_ID,
      });
    });
    expect(loadPage).toHaveBeenCalledTimes(2);
    expect(loadPage.mock.calls[1]?.[0]).toMatchObject({ before: "80" });
  });

  it("does not apply the Claude disk window to non-Claude threads", () => {
    const harness = createHarness({
      window: { hasMore: true, nextCursor: "80" },
    });
    expect(harness.requester("codex:thread")).toBe(false);
    expect(harness.loadPage).not.toHaveBeenCalled();
  });
});
