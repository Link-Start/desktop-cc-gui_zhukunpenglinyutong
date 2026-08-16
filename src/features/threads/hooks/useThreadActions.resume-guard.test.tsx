// @vitest-environment jsdom
import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetUseThreadActionsTestMocks } from "./useThreadActions.test-mocks";
import { loadPiSession, resumeThread } from "../../../services/tauri";
import { renderActions, workspace } from "./useThreadActions.test-utils";

describe("useThreadActions resume guards", () => {
  beforeEach(() => {
    resetUseThreadActionsTestMocks();
  });

  it("skips resume when already loaded", async () => {
    const loadedThreadsRef = { current: { "thread-1": true } };
    const { result } = renderActions({ loadedThreadsRef });

    let threadId: string | null = null;
    await act(async () => {
      threadId = await result.current.resumeThreadForWorkspace("ws-1", "thread-1");
    });

    expect(threadId).toBe("thread-1");
    expect(resumeThread).not.toHaveBeenCalled();
  });

  it("skips resume while processing unless forced", async () => {
    const options = {
      loadedThreadsRef: { current: { "thread-1": true } },
      threadStatusById: {
        "thread-1": {
          isProcessing: true,
          hasUnread: false,
          isReviewing: false,
          processingStartedAt: 123,
          lastDurationMs: null,
        },
      },
    };
    const { result: skipResult } = renderActions(options);

    await act(async () => {
      await skipResult.current.resumeThreadForWorkspace("ws-1", "thread-1");
    });

    expect(resumeThread).not.toHaveBeenCalled();

    vi.mocked(resumeThread).mockResolvedValue({
      result: { thread: { id: "thread-1", updated_at: 1 } },
    });

    const { result: forceResult } = renderActions(options);

    await act(async () => {
      await forceResult.current.resumeThreadForWorkspace("ws-1", "thread-1", true);
    });

    expect(resumeThread).toHaveBeenCalledWith("ws-1", "thread-1");
  });

  it("loads native PI history instead of the Codex resume path", async () => {
    vi.mocked(loadPiSession).mockResolvedValue({
      messages: [
        {
          id: "pi-user-1",
          kind: "message",
          role: "user",
          text: "1+1",
        },
        {
          id: "pi-assistant-1",
          kind: "message",
          role: "assistant",
          text: "2",
        },
      ],
    });
    const { result, dispatch, loadedThreadsRef } = renderActions({
      resolveWorkspacePath: () => workspace.path,
    });

    let threadId: string | null = null;
    await act(async () => {
      threadId = await result.current.resumeThreadForWorkspace(
        "ws-1",
        "pi:019ffb7b-dedc-7b36-8d2f-f85f35501036",
      );
    });

    expect(threadId).toBe("pi:019ffb7b-dedc-7b36-8d2f-f85f35501036");
    expect(resumeThread).not.toHaveBeenCalled();
    expect(loadPiSession).toHaveBeenCalledWith(
      workspace.path,
      "019ffb7b-dedc-7b36-8d2f-f85f35501036",
    );
    expect(dispatch).toHaveBeenCalledWith({
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId: "pi:019ffb7b-dedc-7b36-8d2f-f85f35501036",
      engine: "pi",
    });
    expect(
      loadedThreadsRef.current["pi:019ffb7b-dedc-7b36-8d2f-f85f35501036"],
    ).toBe(true);
  });
});
