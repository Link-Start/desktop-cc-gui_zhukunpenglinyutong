import { describe, expect, it, vi } from "vitest";
import type { DshHistoryLoadProgressEvent } from "./historyLoadingProgress";
import { subscribeMappedDshHistoryLoadProgress } from "./subscribeMappedDshHistoryLoadProgress";

const { subscribeDshHistoryLoadProgress } = vi.hoisted(() => ({
  subscribeDshHistoryLoadProgress: vi.fn<
    (onEvent: (event: DshHistoryLoadProgressEvent) => void) => () => void
  >(),
}));

vi.mock("../../../services/events", () => ({
  subscribeDshHistoryLoadProgress,
}));

describe("subscribeMappedDshHistoryLoadProgress", () => {
  it("maps matching host pages and ignores other sessions", () => {
    const captured: {
      listener: ((event: DshHistoryLoadProgressEvent) => void) | null;
    } = { listener: null };
    subscribeDshHistoryLoadProgress.mockImplementation((onEvent) => {
      captured.listener = onEvent;
      return () => {
        captured.listener = null;
      };
    });
    const onProgress = vi.fn();
    const stop = subscribeMappedDshHistoryLoadProgress({
      threadId: "dsh:sess-1",
      hostSessionId: "sess-1",
      onProgress,
    });

    captured.listener?.({
      sessionId: "other",
      pageIndex: 2,
      maxPages: 40,
      pageEventCount: 10,
      totalEventCount: 10,
      hasMore: true,
    });
    expect(onProgress).not.toHaveBeenCalled();

    captured.listener?.({
      sessionId: "sess-1",
      pageIndex: 2,
      maxPages: 40,
      pageEventCount: 200,
      totalEventCount: 400,
      hasMore: true,
    });
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "session",
        detailKey: "restoringHistorySessionPage",
        detailParams: expect.objectContaining({ page: 2, maxPages: 40 }),
      }),
    );

    stop();
    expect(captured.listener).toBeNull();
  });
});
