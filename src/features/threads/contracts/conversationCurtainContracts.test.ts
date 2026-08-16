import { describe, expect, it } from "vitest";
import {
  NORMALIZED_EVENT_DICTIONARY,
  createConversationState,
  normalizeHistorySnapshot,
} from "./conversationCurtainContracts";

describe("conversationCurtainContracts", () => {
  it("builds an empty conversation state from meta", () => {
    const state = createConversationState({
      workspaceId: "ws-1",
      threadId: "thread-1",
      engine: "codex",
      activeTurnId: null,
      isThinking: false,
      heartbeatPulse: null,
      historyRestoredAtMs: null,
    });
    expect(state.items).toEqual([]);
    expect(state.plan).toBeNull();
    expect(state.userInputQueue).toEqual([]);
    expect(state.meta.threadId).toBe("thread-1");
  });

  it("preserves Claude disk-window hasMore metadata", () => {
    const snapshot = normalizeHistorySnapshot({
      engine: "claude",
      workspaceId: "ws-window",
      threadId: "claude:session-window",
      items: [],
      userInputQueue: [],
      plan: null,
      meta: {
        workspaceId: "ws-window",
        threadId: "claude:session-window",
        engine: "claude",
        activeTurnId: null,
        isThinking: false,
        heartbeatPulse: null,
        historyRestoredAtMs: 1,
        historyHasMore: true,
        historyNextCursor: "80",
      },
    });
    expect(snapshot.meta.historyHasMore).toBe(true);
    expect(snapshot.meta.historyNextCursor).toBe("80");
  });

  it("normalizes missing history fields with explicit fallback warnings", () => {
    const snapshot = normalizeHistorySnapshot({
      engine: "claude",
      workspaceId: "ws-2",
      threadId: "claude:session-1",
    });
    expect(snapshot.items).toEqual([]);
    expect(snapshot.userInputQueue).toEqual([]);
    expect(snapshot.plan).toBeNull();
    expect(snapshot.fallbackWarnings.map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        "missing_items",
        "missing_plan",
        "missing_user_input_queue",
        "missing_meta",
      ]),
    );
  });

  it("keeps dictionary mappings for tool and reasoning aliases", () => {
    expect(NORMALIZED_EVENT_DICTIONARY.tool_call).toBe("tool");
    expect(NORMALIZED_EVENT_DICTIONARY.reasoning_delta).toBe("reasoning");
    expect(NORMALIZED_EVENT_DICTIONARY.image_generation_call).toBe("generatedImage");
  });
});
