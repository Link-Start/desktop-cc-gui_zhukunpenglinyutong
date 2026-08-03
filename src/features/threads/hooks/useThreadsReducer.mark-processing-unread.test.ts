import { describe, expect, it } from "vitest";
import { initialState, threadReducer } from "./useThreadsReducer";

const WORKSPACE = "ws-mark-processing-unread";
const THREAD = "thread-bg-complete";
const OTHER = "thread-other";
const NOW = 1_700_000_100_000;

function withThreadSelected(threadId: string) {
  const ensured = threadReducer(initialState, {
    type: "ensureThread",
    workspaceId: WORKSPACE,
    threadId,
    engine: "codex",
  });
  return threadReducer(ensured, {
    type: "setActiveThreadId",
    workspaceId: WORKSPACE,
    threadId,
  });
}

describe("threadReducer markProcessing background completion unread", () => {
  it("sets hasUnread when a processing turn settles while user is elsewhere", () => {
    let state = withThreadSelected(THREAD);
    state = threadReducer(state, {
      type: "ensureThread",
      workspaceId: WORKSPACE,
      threadId: OTHER,
      engine: "codex",
    });
    state = threadReducer(state, {
      type: "markProcessing",
      threadId: THREAD,
      isProcessing: true,
      timestamp: NOW,
    });
    // Leave the running thread before it finishes.
    state = threadReducer(state, {
      type: "setActiveThreadId",
      workspaceId: WORKSPACE,
      threadId: OTHER,
    });

    state = threadReducer(state, {
      type: "markProcessing",
      threadId: THREAD,
      isProcessing: false,
      timestamp: NOW + 5_000,
    });

    expect(state.threadStatusById[THREAD]?.isProcessing).toBe(false);
    expect(state.threadStatusById[THREAD]?.hasUnread).toBe(true);
  });

  it("does not set hasUnread when the processing turn settles on the active thread", () => {
    let state = withThreadSelected(THREAD);
    state = threadReducer(state, {
      type: "markProcessing",
      threadId: THREAD,
      isProcessing: true,
      timestamp: NOW,
    });
    state = threadReducer(state, {
      type: "markProcessing",
      threadId: THREAD,
      isProcessing: false,
      timestamp: NOW + 5_000,
    });

    expect(state.threadStatusById[THREAD]?.isProcessing).toBe(false);
    expect(state.threadStatusById[THREAD]?.hasUnread).toBe(false);
  });

  it("clears hasUnread when the user opens the completed thread", () => {
    let state = withThreadSelected(THREAD);
    state = threadReducer(state, {
      type: "ensureThread",
      workspaceId: WORKSPACE,
      threadId: OTHER,
      engine: "codex",
    });
    state = threadReducer(state, {
      type: "markProcessing",
      threadId: THREAD,
      isProcessing: true,
      timestamp: NOW,
    });
    state = threadReducer(state, {
      type: "setActiveThreadId",
      workspaceId: WORKSPACE,
      threadId: OTHER,
    });
    state = threadReducer(state, {
      type: "markProcessing",
      threadId: THREAD,
      isProcessing: false,
      timestamp: NOW + 5_000,
    });
    expect(state.threadStatusById[THREAD]?.hasUnread).toBe(true);

    state = threadReducer(state, {
      type: "setActiveThreadId",
      workspaceId: WORKSPACE,
      threadId: THREAD,
    });
    expect(state.threadStatusById[THREAD]?.hasUnread).toBe(false);
  });
});
