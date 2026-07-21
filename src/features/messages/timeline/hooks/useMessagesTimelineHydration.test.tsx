// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createHeavyHistoryFixture } from "../../components/messagesHeavyHistoryFixture.test-support";
import { useMessagesTimelineHydration } from "./useMessagesTimelineHydration";

describe("useMessagesTimelineHydration", () => {
  it("owns heavy-row summary promotion without virtualizer side effects when static", () => {
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
    const heavyState = [...result.current.timelineRowHydrationStateByKey.values()]
      .find((state) => state.heavy);
    const heavyRow = rows.find((row) => row.key === heavyState?.rowKey);

    expect(heavyState?.mode).toBe("summary");
    expect(heavyRow && result.current.shouldRenderLightweightProjectionRow(
      heavyRow,
      heavyState,
    )).toBe(true);
  });
});
