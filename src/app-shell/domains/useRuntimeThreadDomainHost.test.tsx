// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ThreadSummary, WorkspaceInfo } from "../../types";
import { useRuntimeThreadDomainHost } from "./useRuntimeThreadDomainHost";

type HostInput = Parameters<typeof useRuntimeThreadDomainHost>[0];

const workspace: WorkspaceInfo = {
  id: "ws-1",
  name: "demo",
  path: "/tmp/demo",
  connected: true,
  settings: { sidebarCollapsed: false },
};

function makeThread(overrides: Partial<ThreadSummary> = {}): ThreadSummary {
  return {
    id: "thread-1",
    name: "Session",
    updatedAt: 1,
    engineSource: "codex",
    selectedEngine: "claude",
    providerProfileId: "profile-1",
    ...overrides,
  };
}

function buildThreads(overrides: Record<string, unknown> = {}): HostInput["threads"] {
  return {
    activeItems: [],
    activeTurnIdByThread: { "thread-1": "turn-1" },
    completionEmailIntentByThread: {},
    handleFusionStalled: vi.fn(),
    historyLoadingByThreadId: {},
    historyLoadingProgressByThreadId: {},
    historyRestoredAtMsByThread: {},
    interruptTurn: vi.fn(),
    listThreadsForWorkspace: vi.fn(),
    loadOlderThreadsForWorkspace: vi.fn(),
    planByThread: {},
    rateLimitsByWorkspace: {},
    refreshAccountInfo: vi.fn(),
    refreshAccountRateLimits: vi.fn(),
    refreshThread: vi.fn(),
    resetWorkspaceThreads: vi.fn(),
    resolveCanonicalThreadId: vi.fn((id: string) => id),
    sendUserMessage: vi.fn(),
    sendUserMessageToThread: vi.fn(),
    setActiveThreadId: vi.fn(),
    startSharedSessionForWorkspace: vi.fn(),
    startThreadForWorkspace: vi.fn(),
    threadItemsByThread: {},
    threadListCursorByWorkspace: {},
    threadListLoadingByWorkspace: {},
    threadListPagingByWorkspace: {},
    threadParentById: {},
    threadStatusById: {},
    threadsByWorkspace: {},
    tokenUsageByThread: {},
    toggleCompletionEmailIntent: vi.fn(),
    userInputRequests: [],
    ...overrides,
  } as unknown as HostInput["threads"];
}

describe("useRuntimeThreadDomainHost (S4 PR-D)", () => {
  it("projects turn-level active session facts from threads bags", () => {
    const thread = makeThread();
    const threads = buildThreads({
      threadsByWorkspace: { "ws-1": [thread] },
      threadStatusById: { "thread-1": { isProcessing: true } },
      tokenUsageByThread: {
        "thread-1": {
          total: {
            totalTokens: 3,
            inputTokens: 1,
            cachedInputTokens: 0,
            outputTokens: 2,
            reasoningOutputTokens: 0,
          },
          last: null,
          modelContextWindow: null,
        },
      },
    });

    const { result } = renderHook(() =>
      useRuntimeThreadDomainHost({
        threads,
        activeWorkspace: workspace,
        activeWorkspaceId: "ws-1",
        activeThreadId: "thread-1",
      }),
    );

    expect(result.current.activeThreadSummary?.id).toBe("thread-1");
    expect(result.current.activeThreadEngine).toBe("codex");
    expect(result.current.activeThreadProviderProfileId).toBe("profile-1");
    expect(result.current.canInterrupt).toBe(true);
    expect(result.current.isProcessing).toBe(true);
    expect(result.current.isReviewing).toBe(false);
    expect(result.current.activeTurnId).toBe("turn-1");
    expect(result.current.activeTokenUsage?.total.outputTokens).toBe(2);
  });

  it("assembles runtimeThreadBoundary from threads bags + projection", () => {
    const thread = makeThread();
    const threadsByWorkspace = { "ws-1": [thread] };
    const threadStatusById = { "thread-1": { isProcessing: true } };
    const threadItemsByThread = { "thread-1": [] };
    const threads = buildThreads({
      threadsByWorkspace,
      threadStatusById,
      threadItemsByThread,
    });

    const { result } = renderHook(() =>
      useRuntimeThreadDomainHost({
        threads,
        activeWorkspace: workspace,
        activeWorkspaceId: "ws-1",
        activeThreadId: "thread-1",
      }),
    );

    const boundary = result.current.runtimeThreadBoundary;
    // bags 按引用装配
    expect(boundary.threadsByWorkspace).toBe(threadsByWorkspace);
    expect(boundary.threadStatusById).toBe(threadStatusById);
    expect(boundary.threadItemsByThread).toBe(threadItemsByThread);
    // id / workspace / 投影字段
    expect(boundary.activeThreadId).toBe("thread-1");
    expect(boundary.activeWorkspaceId).toBe("ws-1");
    expect(boundary.activeWorkspace).toBe(workspace);
    expect(boundary.activeTurnId).toBe("turn-1");
    expect(boundary.canInterrupt).toBe(true);
    expect(boundary.isProcessing).toBe(true);
    expect(boundary.isReviewing).toBe(false);
    // actions 透传
    expect(boundary.interruptTurn).toBe(threads.interruptTurn);
    expect(boundary.sendUserMessage).toBe(threads.sendUserMessage);
    expect(boundary.setActiveThreadId).toBe(threads.setActiveThreadId);
  });

  it("reflects turn-level status transitions on rerender", () => {
    const thread = makeThread();
    const initialThreads = buildThreads({
      threadsByWorkspace: { "ws-1": [thread] },
      threadStatusById: { "thread-1": { isProcessing: true } },
    });

    const { result, rerender } = renderHook(
      ({ threads }) =>
        useRuntimeThreadDomainHost({
          threads,
          activeWorkspace: workspace,
          activeWorkspaceId: "ws-1",
          activeThreadId: "thread-1",
        }),
      { initialProps: { threads: initialThreads } },
    );
    expect(result.current.isProcessing).toBe(true);
    expect(result.current.runtimeThreadBoundary.isProcessing).toBe(true);

    const settledThreads = buildThreads({
      threadsByWorkspace: { "ws-1": [thread] },
      threadStatusById: { "thread-1": { isProcessing: false } },
    });
    rerender({ threads: settledThreads });

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.canInterrupt).toBe(false);
    expect(result.current.runtimeThreadBoundary.isProcessing).toBe(false);
  });
});
