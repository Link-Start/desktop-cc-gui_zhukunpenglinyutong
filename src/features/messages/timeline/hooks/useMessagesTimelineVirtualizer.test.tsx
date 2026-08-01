// @vitest-environment jsdom
import { createRef } from "react";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useMessagesTimelineVirtualizer,
  useMessagesTimelineVirtualizerLifecycle,
} from "./useMessagesTimelineVirtualizer";

vi.mock("@tanstack/react-virtual", () => ({ useVirtualizer: vi.fn() }));
vi.mock("../../../../services/perfBaseline/useRenderHotspot", () => ({
  useRenderHotspot: vi.fn(),
}));

describe("useMessagesTimelineVirtualizer", () => {
  beforeEach(() => {
    vi.mocked(useVirtualizer).mockReturnValue({
      getVirtualItems: () => [{ key: "row-1", index: 0, start: 0, size: 80 }],
      measureElement: vi.fn(),
      resizeItem: vi.fn(),
    } as never);
  });

  it("owns virtualizer construction and projects virtual row keys", () => {
    const rows = [{ kind: "bottomAnchor" as const, key: "row-1" }];
    const { result } = renderHook(() => useMessagesTimelineVirtualizer({
      activeEngine: "claude",
      activeLiveRowCount: 0,
      claudeHistoryTranscriptFallbackActive: false,
      effectiveItemsCount: 0,
      hasTailUserInputNode: false,
      isThinking: false,
      isWorking: false,
      lastDurationMs: null,
      renderWeight: 1,
      scrollElementRef: createRef<HTMLDivElement>(),
      shouldVirtualizeTimeline: true,
      timelineProjectionRows: rows,
    }));

    expect(vi.mocked(useVirtualizer).mock.calls[0]?.[0]).toMatchObject({
      count: 1,
      enabled: true,
    });
    expect(result.current.virtualTimelineRowKeys).toEqual(["row-1"]);
  });

  it("owns pending-jump scrolling until the message node is mounted", () => {
    const scrollToIndex = vi.fn();
    const timelineVirtualizer = {
      elementsCache: new Map(),
      measure: vi.fn(),
      measureElement: vi.fn(),
      scrollToIndex,
    } as never;

    renderHook(() => useMessagesTimelineVirtualizerLifecycle({
      activeLiveTimelineRowKeys: [],
      hydratedHeavyTimelineRowCount: 0,
      isThinking: false,
      isWorking: false,
      messageNodeByIdRef: { current: new Map() },
      onPendingJumpTargetReady: vi.fn(),
      pendingJumpMessageId: "message-2",
      pendingJumpRowIndex: 1,
      requestBottomConvergence: vi.fn(),
      scrollElementRef: createRef<HTMLDivElement>(),
      shouldVirtualizeTimeline: true,
      threadId: "thread-1",
      timelineProjectionRowCount: 2,
      timelineVirtualizer,
      virtualizedTimelineScopeKey: "workspace-1\0thread-1\0virtualized",
      virtualTimelineRowKeys: ["row-1"],
      workspaceId: "workspace-1",
    }));

    expect(scrollToIndex).toHaveBeenCalledWith(1, { align: "center" });
  });
});
