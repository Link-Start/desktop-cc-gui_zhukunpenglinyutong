// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createHeavyHistoryFixture } from "../test-support/messagesHeavyHistoryFixture";
import { useMessagesTimelineHydration } from "./useMessagesTimelineHydration";

describe("useMessagesTimelineHydration", () => {
  it("keeps direct lightweight inputs on static full-detail rendering", () => {
    const { rows } = createHeavyHistoryFixture("heavy");
    const { result } = renderHook(() => useMessagesTimelineHydration({
      activeLiveTimelineRowKeys: [],
      activeLiveTimelineRowKeySet: new Set(),
      conversationDetailHydrationRequested: false,
      effectiveConversationLightweightMode: true,
      isThinking: false,
      isWorking: false,
      liveAssistantItem: null,
      liveReasoningItem: null,
      pendingJumpRowKey: null,
      rendererOptionsKey: "renderer-1",
      retainedScopeKey: "scope-1",
      shouldDeferHeavyTimelineRows: true,
      shouldVirtualizeTimeline: false,
      threadId: "thread-1",
      timelineProjectionRows: rows,
      timelineVirtualizer: null!,
      visibleTimelineRowKeySet: new Set(),
      workspaceId: "workspace-1",
    }));
    expect(
      [...result.current.timelineRowHydrationStateByKey.values()].every(
        (state) =>
          !state.heavy &&
          state.mode === "static" &&
          state.hydrationReason === "not-heavy",
      ),
    ).toBe(true);
    expect(
      rows.every((row) =>
        !result.current.shouldRenderLightweightProjectionRow(
          row,
          result.current.timelineRowHydrationStateByKey.get(row.key),
        ),
      ),
    ).toBe(true);
  });
});
