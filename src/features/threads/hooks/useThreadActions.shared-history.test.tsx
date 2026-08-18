// @vitest-environment jsdom
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resumeThread } from "../../../services/tauri";
import {
  loadSharedProjection,
  loadSharedSession,
} from "../../shared-session/services/sharedSessions";
import { renderActions } from "./useThreadActions.test-utils";

vi.mock("../../../services/tauri", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../services/tauri")>();
  return {
    ...actual,
    resumeThread: vi.fn(),
  };
});

vi.mock("../../shared-session/services/sharedSessions", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../../shared-session/services/sharedSessions")
    >();
  return {
    ...actual,
    loadSharedProjection: vi.fn(),
    loadSharedSession: vi.fn(),
  };
});

describe("useThreadActions Shared history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.removeItem("mossx.sharedProjection");
  });

  it("accepts a valid empty Shared history without entering Native recovery", async () => {
    vi.mocked(loadSharedSession).mockResolvedValue({
      id: "stable-session-id",
      threadId: "shared:stable-session-id",
      title: "更新后的会话标题",
      selectedEngine: "claude",
      items: [],
    });
    vi.mocked(loadSharedProjection).mockResolvedValue([]);
    const { result, dispatch, loadedThreadsRef } = renderActions({
      useUnifiedHistoryLoader: true,
    });

    await act(async () => {
      await result.current.resumeThreadForWorkspace(
        "ws-1",
        "shared:stable-session-id",
      );
    });

    expect(loadSharedSession).toHaveBeenCalledWith(
      "ws-1",
      "shared:stable-session-id",
    );
    expect(loadSharedProjection).toHaveBeenCalledWith(
      "ws-1",
      "shared:stable-session-id",
    );
    expect(loadSharedProjection).toHaveBeenCalledTimes(1);
    expect(resumeThread).not.toHaveBeenCalled();
    expect(loadedThreadsRef.current["shared:stable-session-id"]).toBe(true);
    expect(
      result.current.historyLoadingByThreadId["shared:stable-session-id"],
    ).toBeUndefined();
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "setThreadHistoryRestoredAt",
        threadId: "shared:stable-session-id",
      }),
    );
  });

  it("does not fall back to Native resume when Shared projection fails after empty V0", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.mocked(loadSharedSession).mockResolvedValue({
      id: "retryable-session-id",
      threadId: "shared:retryable-session-id",
      title: "显示标题不会参与恢复",
      selectedEngine: "claude",
      items: [],
    });
    vi.mocked(loadSharedProjection).mockRejectedValue(
      new Error("canonical projection unavailable"),
    );
    const onDebug = vi.fn();
    const { result, loadedThreadsRef } = renderActions({
      useUnifiedHistoryLoader: true,
      onDebug,
    });

    await act(async () => {
      await result.current.resumeThreadForWorkspace(
        "ws-1",
        "shared:retryable-session-id",
      );
    });

    expect(loadSharedProjection).toHaveBeenCalledTimes(1);
    expect(resumeThread).not.toHaveBeenCalled();
    expect(loadedThreadsRef.current["shared:retryable-session-id"]).toBe(true);
    expect(
      result.current.historyLoadingByThreadId["shared:retryable-session-id"],
    ).toBeUndefined();
    expect(onDebug).not.toHaveBeenCalledWith(
      expect.objectContaining({
        label: "thread/shared history loader error",
      }),
    );
    expect(warn).toHaveBeenCalled();
  });

  it("keeps a failed Shared session load retryable without invoking Native resume", async () => {
    vi.mocked(loadSharedSession).mockRejectedValue(
      new Error("shared session missing"),
    );
    vi.mocked(loadSharedProjection).mockResolvedValue([]);
    const onDebug = vi.fn();
    const { result, loadedThreadsRef } = renderActions({
      useUnifiedHistoryLoader: true,
      onDebug,
    });

    await act(async () => {
      await result.current.resumeThreadForWorkspace(
        "ws-1",
        "shared:missing-session-id",
      );
      await result.current.resumeThreadForWorkspace(
        "ws-1",
        "shared:missing-session-id",
      );
    });

    expect(loadSharedSession).toHaveBeenCalledTimes(2);
    expect(resumeThread).not.toHaveBeenCalled();
    expect(loadedThreadsRef.current["shared:missing-session-id"]).toBe(false);
    expect(
      result.current.historyLoadingByThreadId["shared:missing-session-id"],
    ).toBeUndefined();
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "thread/shared history loader error",
        payload: expect.objectContaining({
          threadId: "shared:missing-session-id",
        }),
      }),
    );
  });

  it("clears Shared history loading after V0 Phase-A while projection is still pending", async () => {
    let resolveProjection: (value: unknown[]) => void = () => undefined;
    const projectionPromise = new Promise<unknown[]>((resolve) => {
      resolveProjection = resolve;
    });
    vi.mocked(loadSharedSession).mockResolvedValue({
      id: "phase-a-session",
      threadId: "shared:phase-a-session",
      selectedEngine: "claude",
      items: [
        {
          id: "v0-user",
          kind: "message",
          role: "user",
          text: "already painted from V0",
        },
      ],
    });
    vi.mocked(loadSharedProjection).mockReturnValue(projectionPromise);
    const { result, dispatch } = renderActions({
      useUnifiedHistoryLoader: true,
    });

    act(() => {
      result.current.setThreadHistoryLoading("shared:phase-a-session", true);
    });
    expect(
      result.current.historyLoadingByThreadId["shared:phase-a-session"],
    ).toBe(true);

    let resumePromise: Promise<string | null> = Promise.resolve(null);
    act(() => {
      resumePromise = result.current.resumeThreadForWorkspace(
        "ws-1",
        "shared:phase-a-session",
      );
    });

    await waitFor(() => {
      expect(
        result.current.historyLoadingByThreadId["shared:phase-a-session"],
      ).toBeUndefined();
    });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "setThreadItems",
        threadId: "shared:phase-a-session",
      }),
    );
    expect(loadSharedProjection).toHaveBeenCalledTimes(1);

    resolveProjection([]);
    await act(async () => {
      await resumePromise;
    });
    expect(resumeThread).not.toHaveBeenCalled();
    const setThreadItemsCalls = dispatch.mock.calls.filter(
      (call) =>
        typeof call[0] === "object" &&
        call[0] !== null &&
        "type" in call[0] &&
        call[0].type === "setThreadItems",
    );
    expect(setThreadItemsCalls).toHaveLength(1);
  });
});
