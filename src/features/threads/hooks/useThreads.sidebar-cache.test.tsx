// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import {
  deleteWorkspaceSessions,
  listThreads,
  loadClaudeSession,
  loadDshSession,
  resumeThread,
} from "../../../services/tauri";
import {
  writeClientStoreData,
  writeClientStoreValue,
} from "../../../services/clientStorage";
import type { useAppServerEvents } from "../../app/hooks/useAppServerEvents";
import { useThreads } from "./useThreads";
import { loadSidebarSnapshot } from "../utils/sidebarSnapshot";

type AppServerHandlers = Parameters<typeof useAppServerEvents>[0];

vi.mock("../../app/hooks/useAppServerEvents", () => ({
  useAppServerEvents: (_incoming: AppServerHandlers) => {},
}));

vi.mock("./useThreadRateLimits", () => ({
  useThreadRateLimits: () => ({
    refreshAccountRateLimits: vi.fn(),
  }),
}));

vi.mock("./useThreadAccountInfo", () => ({
  useThreadAccountInfo: () => ({
    refreshAccountInfo: vi.fn(),
  }),
}));

vi.mock("../../../services/tauri", () => ({
  respondToServerRequest: vi.fn(),
  respondToUserInputRequest: vi.fn(),
  listThreadTitles: vi.fn().mockResolvedValue({}),
  setThreadTitle: vi.fn(),
  renameThreadTitleKey: vi.fn(),
  generateThreadTitle: vi.fn(),
  rememberApprovalRule: vi.fn(),
  sendUserMessage: vi.fn(),
  startReview: vi.fn(),
  startThread: vi.fn(),
  listThreads: vi.fn(),
  loadClaudeSession: vi.fn(),
  loadDshSession: vi.fn(),
  resumeThread: vi.fn(),
  archiveThread: vi.fn(),
  deleteWorkspaceSessions: vi.fn(),
  deleteOpenCodeSession: vi.fn(),
  getAccountRateLimits: vi.fn(),
  getAccountInfo: vi.fn(),
  interruptTurn: vi.fn(),
  approveToolCall: vi.fn(),
  denyToolCall: vi.fn(),
  executeSlashCommand: vi.fn(),
  branchWorkspace: vi.fn(),
  startMcpSession: vi.fn(),
  startSpecRootSession: vi.fn(),
  startStatusSession: vi.fn(),
  startContextSession: vi.fn(),
  startFastSession: vi.fn(),
  startModeSession: vi.fn(),
  startExportSession: vi.fn(),
  startImportSession: vi.fn(),
  startLspSession: vi.fn(),
  startShareSession: vi.fn(),
  listWorkspaceSessions: vi.fn().mockResolvedValue({
    data: [],
    nextCursor: null,
    partialSource: null,
  }),
  listWorkspaceSessionArchiveEvidence: vi.fn().mockResolvedValue({
    archivedAtBySessionId: {},
    sourceStatuses: [],
    partialSource: null,
  }),
  listWorkspacePlugins: vi.fn(),
  addWorkspacePlugin: vi.fn(),
  removeWorkspacePlugin: vi.fn(),
  listWorkspaceProviderProfiles: vi.fn(),
  saveWorkspaceProviderProfile: vi.fn(),
  removeWorkspaceProviderProfile: vi.fn(),
  saveWorkspaceProviderSelection: vi.fn(),
  listWorkspaceOpenCodeAgents: vi.fn(),
  projectMemoryUpdate: vi.fn(),
  projectMemoryCreate: vi.fn(),
  connectWorkspace: vi.fn(),
  listGeminiSessions: vi.fn().mockResolvedValue([]),
  listGrokSessions: vi.fn().mockResolvedValue([]),
  listKimiSessions: vi.fn().mockResolvedValue([]),
  listDshSessions: vi.fn().mockResolvedValue([]),
  listPiSessions: vi.fn().mockResolvedValue([]),
  listSessionIndexForWorkspace: vi.fn().mockResolvedValue({
    data: [],
    source: "session-index",
    synced: false,
    engines: [],
    visibility: {
      available: true,
      freshness: "verified",
      hiddenNativeIds: [],
    },
  }),
  listClaudeSessions: vi.fn().mockResolvedValue([]),
  getOpenCodeSessionList: vi.fn().mockResolvedValue([]),
  getEmailInboundListenerStatus: vi.fn().mockResolvedValue({
    enabled: false,
    readOnly: true,
    connectionState: "disabled",
    lastCheckedAt: null,
    nextCheckAt: null,
    acceptedCount: 0,
    queuedCount: 0,
    needsConfirmationCount: 0,
    rejectedCount: 0,
    ignoredCount: 0,
    pollingIntervalSeconds: 300,
  }),
  checkEmailInbox: vi.fn(),
  claimNextEmailMailCommand: vi.fn().mockResolvedValue({ command: null }),
  completeEmailMailCommand: vi.fn(),
}));

const workspace: WorkspaceInfo = {
  id: "ws-1",
  name: "ccgui",
  path: "/tmp/codex",
  connected: true,
  settings: { sidebarCollapsed: false },
};

describe("useThreads sidebar cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writeClientStoreData("threads", {});
    vi.mocked(loadClaudeSession).mockResolvedValue({ messages: [] });
    vi.mocked(loadDshSession).mockResolvedValue({ messages: [] });
  });

  it("hydrates cached thread summaries before live thread list resolves", () => {
    writeClientStoreValue("threads", "sidebarSnapshot", {
      version: 1,
      updatedAt: 123,
      workspaces: [workspace],
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-1", name: "Cached chat", updatedAt: 123 }],
      },
    });

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      }),
    );

    expect(result.current.threadsByWorkspace["ws-1"]).toEqual([
      expect.objectContaining({ id: "thread-1", name: "Cached chat" }),
    ]);
  });

  it("rewrites cached thread summaries after a successful live list", async () => {
    vi.mocked(listThreads).mockResolvedValue({
      result: {
        data: [
          {
            id: "thread-2",
            cwd: workspace.path,
            preview: "Fresh chat",
            updated_at: 456,
          },
        ],
        nextCursor: null,
      },
    } as never);

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.listThreadsForWorkspace(workspace);
    });

    await waitFor(() => {
      expect(loadSidebarSnapshot()?.threadsByWorkspace["ws-1"]).toEqual([
        expect.objectContaining({ id: "thread-2" }),
      ]);
    });
  });

  it("tracks Codex history loading while selecting an unloaded thread", async () => {
    vi.useFakeTimers();
    let resolveResume:
      | ((value: {
          result: {
            thread: {
              id: string;
              preview: string;
              updated_at: number;
              turns: unknown[];
            };
          };
        }) => void)
      | null = null;
    vi.mocked(resumeThread).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveResume = resolve;
        }) as never,
    );

    try {
      const { result } = renderHook(() =>
        useThreads({
          activeWorkspace: workspace,
          onWorkspaceConnected: vi.fn(),
        }),
      );

      act(() => {
        result.current.setActiveThreadId("thread-history");
      });

      expect(result.current.historyLoadingByThreadId["thread-history"]).toBe(
        true,
      );

      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      expect(vi.mocked(resumeThread)).toHaveBeenCalledWith(
        "ws-1",
        "thread-history",
      );
      expect(result.current.historyLoadingByThreadId["thread-history"]).toBe(
        true,
      );

      await act(async () => {
        resolveResume?.({
          result: {
            thread: {
              id: "thread-history",
              preview: "Loaded thread",
              updated_at: 456,
              turns: [
                {
                  items: [
                    {
                      type: "agentMessage",
                      id: "assistant-thread-history",
                      text: "Loaded history",
                    },
                  ],
                },
              ],
            },
          },
        });
        await Promise.resolve();
      });

      expect(
        result.current.historyLoadingByThreadId["thread-history"],
      ).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps cached items visible when reselecting an already-loaded thread", async () => {
    vi.useFakeTimers();
    vi.mocked(resumeThread).mockResolvedValue({
      result: {
        thread: {
          id: "thread-history",
          preview: "Loaded thread",
          updated_at: 456,
          turns: [
            {
              items: [
                {
                  type: "agentMessage",
                  id: "assistant-thread-history",
                  text: "Loaded history",
                },
              ],
            },
          ],
        },
      },
    } as never);

    try {
      const { result } = renderHook(() =>
        useThreads({
          activeWorkspace: workspace,
          onWorkspaceConnected: vi.fn(),
        }),
      );

      act(() => {
        result.current.setActiveThreadId("thread-history");
      });
      await act(async () => {
        vi.advanceTimersByTime(50);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current.activeItems).toEqual([
        expect.objectContaining({
          id: "assistant-thread-history",
          text: "Loaded history",
        }),
      ]);

      act(() => {
        result.current.setActiveThreadId("thread-history-other");
      });
      expect(result.current.activeItems).toEqual([]);

      act(() => {
        result.current.setActiveThreadId("thread-history");
      });
      expect(result.current.activeItems).toEqual([
        expect.objectContaining({
          id: "assistant-thread-history",
          text: "Loaded history",
        }),
      ]);
      expect(
        result.current.historyLoadingByThreadId["thread-history"],
      ).toBeUndefined();
      expect(vi.mocked(resumeThread)).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not clear the next selected thread loading state when an older resume finishes", async () => {
    vi.useFakeTimers();
    const resumeResolvers = new Map<
      string,
      (value: {
        result: {
          thread: {
            id: string;
            preview: string;
            updated_at: number;
            turns: unknown[];
          };
        };
      }) => void
    >();
    vi.mocked(resumeThread).mockImplementation(
      (_workspaceId, threadId) =>
        new Promise((resolve) => {
          resumeResolvers.set(String(threadId), resolve);
        }) as never,
    );

    try {
      const { result } = renderHook(() =>
        useThreads({
          activeWorkspace: workspace,
          onWorkspaceConnected: vi.fn(),
        }),
      );

      act(() => {
        result.current.setActiveThreadId("thread-history-a");
      });
      await act(async () => {
        vi.advanceTimersByTime(50);
      });
      expect(result.current.historyLoadingByThreadId["thread-history-a"]).toBe(
        true,
      );

      act(() => {
        result.current.setActiveThreadId("thread-history-b");
      });
      expect(
        result.current.historyLoadingByThreadId["thread-history-a"],
      ).toBeUndefined();
      expect(result.current.historyLoadingByThreadId["thread-history-b"]).toBe(
        true,
      );

      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      await act(async () => {
        resumeResolvers.get("thread-history-a")?.({
          result: {
            thread: {
              id: "thread-history-a",
              preview: "Loaded older thread",
              updated_at: 456,
              turns: [
                {
                  items: [
                    {
                      type: "agentMessage",
                      id: "assistant-thread-history-a",
                      text: "Loaded older history",
                    },
                  ],
                },
              ],
            },
          },
        });
        await Promise.resolve();
      });

      expect(result.current.activeThreadId).toBe("thread-history-b");
      expect(result.current.historyLoadingByThreadId["thread-history-b"]).toBe(
        true,
      );

      await act(async () => {
        resumeResolvers.get("thread-history-b")?.({
          result: {
            thread: {
              id: "thread-history-b",
              preview: "Loaded current thread",
              updated_at: 457,
              turns: [
                {
                  items: [
                    {
                      type: "agentMessage",
                      id: "assistant-thread-history-b",
                      text: "Loaded current history",
                    },
                  ],
                },
              ],
            },
          },
        });
        await Promise.resolve();
      });

      expect(
        result.current.historyLoadingByThreadId["thread-history-b"],
      ).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("tracks Claude history loading while selecting an unloaded session", async () => {
    vi.mocked(listThreads).mockResolvedValue({
      result: { data: [], nextCursor: null },
    } as never);
    let resolveLoad: ((value: { messages: unknown[] }) => void) | null = null;
    vi.mocked(loadClaudeSession).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLoad = resolve;
        }) as never,
    );

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.listThreadsForWorkspace(workspace);
    });

    vi.useFakeTimers();
    try {
      act(() => {
        result.current.setActiveThreadId("claude:session-history");
      });

      expect(
        result.current.historyLoadingByThreadId["claude:session-history"],
      ).toBe(true);

      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      expect(vi.mocked(loadClaudeSession)).toHaveBeenCalledWith(
        "/tmp/codex",
        "session-history",
        { limit: 80 },
      );
      expect(
        result.current.historyLoadingByThreadId["claude:session-history"],
      ).toBe(true);

      await act(async () => {
        resolveLoad?.({
          messages: [
            {
              kind: "message",
              id: "assistant-session-history",
              role: "assistant",
              text: "Loaded Claude history",
            },
          ],
        });
        await Promise.resolve();
      });

      expect(
        result.current.historyLoadingByThreadId["claude:session-history"],
      ).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("tracks DSH history loading while selecting an unloaded session", async () => {
    let resolveLoad: ((value: { messages: unknown[] }) => void) | null = null;
    vi.mocked(loadDshSession).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLoad = resolve;
        }) as never,
    );

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      }),
    );

    vi.useFakeTimers();
    try {
      act(() => {
        result.current.setActiveThreadId("dsh:session-history");
      });

      expect(
        result.current.historyLoadingByThreadId["dsh:session-history"],
      ).toBe(true);
      expect(
        result.current.historyLoadingProgressByThreadId["dsh:session-history"],
      ).toBeUndefined();

      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      expect(vi.mocked(loadDshSession)).toHaveBeenCalledWith(
        "/tmp/codex",
        "session-history",
      );
      expect(
        result.current.historyLoadingByThreadId["dsh:session-history"],
      ).toBe(true);

      await act(async () => {
        resolveLoad?.({
          messages: [
            {
              role: "assistant",
              content: "Loaded DSH history",
            },
          ],
        });
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(
        result.current.historyLoadingByThreadId["dsh:session-history"],
      ).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not mark pending DSH threads as history loading", async () => {
    vi.useFakeTimers();

    try {
      const { result } = renderHook(() =>
        useThreads({
          activeWorkspace: workspace,
          onWorkspaceConnected: vi.fn(),
        }),
      );

      act(() => {
        result.current.setActiveThreadId("dsh-pending-1");
      });

      expect(
        result.current.historyLoadingByThreadId["dsh-pending-1"],
      ).toBeUndefined();

      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      expect(loadDshSession).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not resume a never-started DSH session with empty disk metadata", async () => {
    vi.useFakeTimers();
    writeClientStoreValue("threads", "sidebarSnapshot", {
      version: 1,
      updatedAt: 123,
      workspaces: [workspace],
      threadsByWorkspace: {
        "ws-1": [
          {
            id: "dsh:new-empty",
            name: "New DSH chat",
            updatedAt: 123,
            engineSource: "dsh",
            sizeBytes: 0,
          },
        ],
      },
    });

    try {
      const { result } = renderHook(() =>
        useThreads({
          activeWorkspace: workspace,
          onWorkspaceConnected: vi.fn(),
        }),
      );

      act(() => {
        result.current.setActiveThreadId("dsh:new-empty");
      });

      expect(
        result.current.historyLoadingByThreadId["dsh:new-empty"],
      ).toBeUndefined();

      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      expect(loadDshSession).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows Shared restore progress on the select-frame curtain", () => {
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      }),
    );

    act(() => {
      result.current.setActiveThreadId("shared:session-history");
    });

    expect(
      result.current.historyLoadingByThreadId["shared:session-history"],
    ).toBe(true);
    expect(
      result.current.historyLoadingProgressByThreadId["shared:session-history"],
    ).toEqual({
      phase: "prepare",
      percent: 8,
      titleKey: "restoringSharedHistory",
      detailKey: "restoringSharedHistoryPrepare",
    });
  });

  it("loads cached Claude sessions before live thread list seeds the workspace path", async () => {
    vi.useFakeTimers();
    writeClientStoreValue("threads", "sidebarSnapshot", {
      version: 1,
      updatedAt: 123,
      workspaces: [workspace],
      threadsByWorkspace: {
        "ws-1": [
          {
            id: "claude:cached-session",
            name: "Cached Claude chat",
            updatedAt: 123,
            engineSource: "claude",
            threadKind: "native",
          },
        ],
      },
    });
    vi.mocked(loadClaudeSession).mockResolvedValue({
      messages: [
        {
          uuid: "msg-1",
          kind: "message",
          id: "assistant-cached-session",
          role: "assistant",
          text: "Cached Claude history",
        },
      ],
    });

    try {
      const { result } = renderHook(() =>
        useThreads({
          activeWorkspace: workspace,
          onWorkspaceConnected: vi.fn(),
        }),
      );

      act(() => {
        result.current.setActiveThreadId("claude:cached-session");
      });

      await act(async () => {
        vi.advanceTimersByTime(50);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(loadClaudeSession).toHaveBeenCalledWith(
        workspace.path,
        "cached-session",
        { limit: 80 },
      );
      expect(
        result.current.historyLoadingByThreadId["claude:cached-session"],
      ).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not mark pending Codex threads as history loading", async () => {
    vi.useFakeTimers();

    try {
      const { result } = renderHook(() =>
        useThreads({
          activeWorkspace: workspace,
          onWorkspaceConnected: vi.fn(),
        }),
      );

      act(() => {
        result.current.setActiveThreadId("codex-pending-1");
      });

      expect(
        result.current.historyLoadingByThreadId["codex-pending-1"],
      ).toBeUndefined();

      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      expect(resumeThread).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not resume a never-started session with empty disk metadata", async () => {
    vi.useFakeTimers();
    writeClientStoreValue("threads", "sidebarSnapshot", {
      version: 1,
      updatedAt: 123,
      workspaces: [workspace],
      threadsByWorkspace: {
        "ws-1": [
          {
            id: "claude:new-empty",
            name: "New chat",
            updatedAt: 123,
            engineSource: "claude",
            sizeBytes: 0,
          },
        ],
      },
    });

    try {
      const { result } = renderHook(() =>
        useThreads({
          activeWorkspace: workspace,
          onWorkspaceConnected: vi.fn(),
        }),
      );

      act(() => {
        result.current.setActiveThreadId("claude:new-empty");
      });

      expect(
        result.current.historyLoadingByThreadId["claude:new-empty"],
      ).toBeUndefined();

      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      expect(resumeThread).not.toHaveBeenCalled();
      expect(loadClaudeSession).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops automatic history retries after failure but allows explicit retry", async () => {
    vi.useFakeTimers();
    vi.mocked(resumeThread)
      .mockRejectedValueOnce(new Error("resume failed"))
      .mockResolvedValueOnce({
        result: {
          thread: {
            id: "thread-history-error",
            preview: "Recovered explicitly",
            updated_at: 456,
            turns: [
              {
                items: [
                  {
                    type: "agentMessage",
                    id: "assistant-history-explicit-retry",
                    text: "Recovered by explicit retry",
                  },
                ],
              },
            ],
          },
        },
      } as never);

    try {
      const { result } = renderHook(() =>
        useThreads({
          activeWorkspace: workspace,
          onWorkspaceConnected: vi.fn(),
        }),
      );

      act(() => {
        result.current.setActiveThreadId("thread-history-error");
      });

      expect(
        result.current.historyLoadingByThreadId["thread-history-error"],
      ).toBe(true);

      await act(async () => {
        vi.advanceTimersByTime(50);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(
        result.current.historyLoadingByThreadId["thread-history-error"],
      ).toBe("failed");

      act(() => {
        result.current.setActiveThreadId("thread-history-other");
      });
      act(() => {
        result.current.setActiveThreadId("thread-history-error");
      });
      await act(async () => {
        vi.advanceTimersByTime(50);
        await Promise.resolve();
      });

      expect(resumeThread).toHaveBeenCalledTimes(1);
      expect(
        result.current.historyLoadingByThreadId["thread-history-error"],
      ).toBe("failed");

      await act(async () => {
        await result.current.refreshThread("ws-1", "thread-history-error");
      });

      expect(resumeThread).toHaveBeenCalledTimes(2);
      expect(
        result.current.historyLoadingByThreadId["thread-history-error"],
      ).toBeUndefined();
      expect(result.current.activeItems).toEqual([
        expect.objectContaining({
          id: "assistant-history-explicit-retry",
          text: "Recovered by explicit retry",
        }),
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("batch deletes codex sessions through the settings fast path", async () => {
    vi.mocked(listThreads).mockResolvedValue({
      result: {
        data: [
          {
            id: "thread-1",
            cwd: workspace.path,
            preview: "Fresh chat 1",
            updated_at: 456,
          },
          {
            id: "thread-2",
            cwd: workspace.path,
            preview: "Fresh chat 2",
            updated_at: 455,
          },
        ],
        nextCursor: null,
      },
    } as never);
    vi.mocked(deleteWorkspaceSessions).mockResolvedValue({
      results: [
        {
          sessionId: "thread-1",
          ok: true,
          archivedAt: null,
          error: null,
          code: "SESSION_DELETED",
          deletedFromDisk: true,
          metadataCleaned: true,
        },
        {
          sessionId: "thread-2",
          ok: true,
          archivedAt: null,
          error: null,
          code: "SESSION_DELETED",
          deletedFromDisk: true,
          metadataCleaned: true,
        },
      ],
    });

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.listThreadsForWorkspace(workspace);
    });

    await act(async () => {
      const deleted = await result.current.removeThreads("ws-1", [
        "thread-1",
        "thread-2",
      ]);
      expect(deleted).toEqual([
        { threadId: "thread-1", success: true, code: null, message: null },
        { threadId: "thread-2", success: true, code: null, message: null },
      ]);
    });

    expect(deleteWorkspaceSessions).toHaveBeenCalledWith("ws-1", [
      "thread-1",
      "thread-2",
    ]);
    expect(result.current.threadsByWorkspace["ws-1"]).toEqual([]);
  });

  it("treats missing codex sessions as settled deletes in the settings fast path", async () => {
    vi.mocked(listThreads).mockResolvedValue({
      result: {
        data: [
          {
            id: "thread-missing",
            cwd: workspace.path,
            preview: "Ghost chat",
            updated_at: 456,
          },
          {
            id: "thread-ok",
            cwd: workspace.path,
            preview: "Fresh chat",
            updated_at: 455,
          },
        ],
        nextCursor: null,
      },
    } as never);
    vi.mocked(deleteWorkspaceSessions).mockResolvedValue({
      results: [
        {
          sessionId: "thread-missing",
          ok: false,
          archivedAt: null,
          error: "codex session file not found for session thread-missing",
          code: "SESSION_DELETE_FAILED",
          deletedFromDisk: false,
          metadataCleaned: false,
        },
        {
          sessionId: "thread-ok",
          ok: true,
          archivedAt: null,
          error: null,
          code: "SESSION_DELETED",
          deletedFromDisk: true,
          metadataCleaned: true,
        },
      ],
    });

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.listThreadsForWorkspace(workspace);
    });

    await act(async () => {
      const deleted = await result.current.removeThreads("ws-1", [
        "thread-missing",
        "thread-ok",
      ]);
      expect(deleted).toEqual([
        {
          threadId: "thread-missing",
          success: true,
          code: null,
          message: null,
        },
        { threadId: "thread-ok", success: true, code: null, message: null },
      ]);
    });

    expect(result.current.threadsByWorkspace["ws-1"]).toEqual([]);
  });
});
