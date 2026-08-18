import { describe, expect, it, vi } from "vitest";
import { subscribeMappedDshHistoryLoadProgress } from "./subscribeMappedDshHistoryLoadProgress";

const { subscribeDshHistoryLoadProgress } = vi.hoisted(() => ({
  subscribeDshHistoryLoadProgress: vi.fn(),
}));

vi.mock("../../../services/events", () => ({
  subscribeDshHistoryLoadProgress,
}));

describe("subscribeMappedDshHistoryLoadProgress", () => {
  it("maps matching host pages and ignores other sessions", () => {
    let listener:
      | ((event: {
          sessionId: string;
          pageIndex: number;
          maxPages: number;
          pageEventCount: number;
          totalEventCount: number;
          hasMore: boolean;
        }) => void)
      | null = null;
    subscribeDshHistoryLoadProgress.mockImplementation((onEvent) => {
      listener = onEvent;
      return () => {
        listener = null;
      };
    });
    const onProgress = vi.fn();
    const stop = subscribeMappedDshHistoryLoadProgress({
      threadId: "dsh:sess-1",
      hostSessionId: "sess-1",
      onProgress,
    });

    listener?.({
      sessionId: "other",
      pageIndex: 2,
      maxPages: 40,
      pageEventCount: 10,
      totalEventCount: 10,
      hasMore: true,
    });
    expect(onProgress).not.toHaveBeenCalled();

    listener?.({
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
    expect(listener).toBeNull();
  });
});
