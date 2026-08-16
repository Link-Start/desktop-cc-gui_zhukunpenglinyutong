// @vitest-environment jsdom
/**
 * Full-catalog apply batches (early index paint / Gemini·Grok·Kimi follow-up
 * merges) must yield one macrotask when input is pending so cold-start clicks
 * reach the WebView before the next setThreads commit — and a newer list
 * request that lands during the yield must win over the parked older apply
 * (requestSeq + isStale guard, no out-of-order overwrite).
 */
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../types";
import {
  connectWorkspace,
  createWorkspaceDirectory,
  getOpenCodeSessionList,
  listClaudeSessions,
  listGeminiSessions,
  listGrokSessions,
  listKimiSessions,
  listDshSessions,
  listPiSessions,
  listThreadTitles,
  listThreads,
  listWorkspaceSessions,
  listWorkspaceSessionArchiveEvidence,
  renameThreadTitleKey,
  setThreadTitle,
} from "../../../services/tauri";
import { listSharedSessions } from "../../shared-session/services/sharedSessions";
import {
  getThreadTimestamp,
  mergeThreadItems,
  previewThreadName,
} from "../../../utils/threadItems";
import { clearGlobalRuntimeNotices } from "../../../services/globalRuntimeNotices";
import { loadSidebarSnapshot } from "../utils/sidebarSnapshot";
import {
  expectSetThreadsDispatched,
  renderActions,
  workspace,
} from "./useThreadActions.test-utils";

/**
 * Controllable stand-in for the real input-pending yield: "blocked" parks at
 * the batch boundary until the test releases it (input kept pending),
 * "immediate" passes straight through (user quiet).
 */
const yieldGate = vi.hoisted(() => ({
  mode: "immediate" as "immediate" | "blocked",
  calls: 0,
  releases: [] as Array<() => void>,
}));

vi.mock("../../../utils/interactiveMainThread", async () => {
  const actual = await vi.importActual<
    typeof import("../../../utils/interactiveMainThread")
  >("../../../utils/interactiveMainThread");
  return {
    ...actual,
    yieldIfInteractiveInputPending: vi.fn(async () => {
      yieldGate.calls += 1;
      if (yieldGate.mode === "blocked") {
        await new Promise<void>((resolve) => {
          yieldGate.releases.push(resolve);
        });
      }
    }),
  };
});

vi.mock("../../../services/tauri", () => ({
  startThread: vi.fn(),
  connectWorkspace: vi.fn(),
  createWorkspaceDirectory: vi.fn(),
  forkClaudeSession: vi.fn(),
  forkClaudeSessionFromMessage: vi.fn(),
  forkThread: vi.fn(),
  rewindCodexThread: vi.fn(),
  listClaudeSessions: vi.fn(),
  listGeminiSessions: vi.fn(),
  listKimiSessions: vi.fn(),
  listDshSessions: vi.fn(),
  listPiSessions: vi.fn(),
  listGrokSessions: vi.fn(),
  getOpenCodeSessionList: vi.fn(),
  listWorkspaceSessions: vi.fn(),
  listWorkspaceSessionArchiveEvidence: vi.fn(),
  listSessionIndexForWorkspace: vi.fn(async () => ({
    data: [],
    source: "session-index",
    synced: false,
    engines: [],
  })),
  syncSessionIndexForWorkspace: vi.fn(async () => ({
    upserted: 0,
    engines: [],
    durationMs: 0,
    skippedFresh: true,
  })),
  loadClaudeSession: vi.fn(),
  loadGeminiSession: vi.fn(),
  loadCodexSession: vi.fn(),
  listThreadTitles: vi.fn(),
  readWorkspaceFile: vi.fn(),
  renameThreadTitleKey: vi.fn(),
  setThreadTitle: vi.fn(),
  resumeThread: vi.fn(),
  listThreads: vi.fn(),
  archiveThread: vi.fn(),
  deleteCodexSession: vi.fn(),
  deleteClaudeSession: vi.fn(),
  deleteGeminiSession: vi.fn(),
  deleteOpenCodeSession: vi.fn(),
  trashWorkspaceItem: vi.fn(),
  writeWorkspaceFile: vi.fn(),
}));

vi.mock("../../shared-session/services/sharedSessions", () => ({
  listSharedSessions: vi.fn(async () => []),
}));

vi.mock("../../../utils/threadItems", () => ({
  buildItemsFromThread: vi.fn(),
  extractClaudeApprovalResumeEntries: vi.fn(() => []),
  getThreadTimestamp: vi.fn(),
  isReviewingFromThread: vi.fn(),
  mergeThreadItems: vi.fn(),
  normalizeItem: vi.fn((item: ConversationItem) => item),
  previewThreadName: vi.fn(),
  stripClaudeApprovalResumeArtifacts: vi.fn((text: string) => text),
}));

vi.mock("../utils/threadStorage", () => ({
  makeCustomNameKey: (workspaceId: string, threadId: string) =>
    `${workspaceId}:${threadId}`,
  saveThreadActivity: vi.fn(),
}));

vi.mock("../utils/sidebarSnapshot", () => ({
  loadSidebarSnapshot: vi.fn(() => null),
}));

function appliedThreadIds(dispatch: ReturnType<typeof vi.fn>): string[] {
  return dispatch.mock.calls
    .filter((call) => call[0] && call[0].type === "setThreads")
    .flatMap((call) =>
      (call[0].threads as Array<{ id: string }>).map((thread) => thread.id),
    );
}

function releaseYieldGate() {
  const releases = yieldGate.releases.splice(0, yieldGate.releases.length);
  releases.forEach((release) => release());
}

describe("useThreadActions list apply input-aware yield", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    yieldGate.mode = "immediate";
    yieldGate.calls = 0;
    yieldGate.releases = [];
    vi.mocked(listSharedSessions).mockResolvedValue([]);
    vi.mocked(listClaudeSessions).mockResolvedValue([]);
    vi.mocked(listKimiSessions).mockResolvedValue([]);
    vi.mocked(listGrokSessions).mockResolvedValue([]);
    vi.mocked(listPiSessions).mockResolvedValue([]);
    vi.mocked(listDshSessions).mockResolvedValue([]);
    vi.mocked(getOpenCodeSessionList).mockResolvedValue([]);
    vi.mocked(listWorkspaceSessions).mockResolvedValue({
      data: [],
      nextCursor: null,
      partialSource: null,
    });
    vi.mocked(listWorkspaceSessionArchiveEvidence).mockResolvedValue({
      archivedAtBySessionId: {},
      partialSource: null,
      sourceStatuses: [],
    });
    vi.mocked(listThreads).mockResolvedValue({
      result: { data: [], nextCursor: null },
    } as never);
    vi.mocked(listThreadTitles).mockResolvedValue({});
    vi.mocked(renameThreadTitleKey).mockResolvedValue(undefined);
    vi.mocked(setThreadTitle).mockResolvedValue("title");
    vi.mocked(connectWorkspace).mockResolvedValue(undefined);
    vi.mocked(createWorkspaceDirectory).mockResolvedValue(undefined);
    vi.mocked(previewThreadName).mockImplementation(
      (text: string, fallback: string) => {
        const trimmed = (text ?? "").trim();
        return trimmed || fallback;
      },
    );
    vi.mocked(getThreadTimestamp).mockImplementation((thread) => {
      const value = (thread as Record<string, unknown>).updated_at as
        | number
        | undefined;
      return value ?? 0;
    });
    vi.mocked(loadSidebarSnapshot).mockReturnValue(null);
    vi.mocked(mergeThreadItems).mockImplementation(
      (primaryItems: ConversationItem[]) => primaryItems,
    );
    clearGlobalRuntimeNotices();
  });

  it("parks the gemini follow-up commit at the batch boundary while input is pending", async () => {
    yieldGate.mode = "blocked";
    vi.mocked(listGeminiSessions).mockResolvedValue([
      {
        sessionId: "ses_yield_1",
        firstMessage: "Yield me",
        updatedAt: 1_730_000_100_000,
      },
    ] as never);

    const { result, dispatch } = renderActions();
    await act(async () =>
      result.current.listThreadsForWorkspace(workspace, {
        preserveState: true,
        startupHydrationMode: "full-catalog",
        includeEngineDiskLists: true,
      }),
    );

    // Main full-catalog body settled; the gemini follow-up merge is parked at
    // the input-pending yield and must not have committed yet.
    await waitFor(() => {
      expect(yieldGate.calls).toBeGreaterThan(0);
    });
    expect(appliedThreadIds(dispatch)).not.toContain("gemini:ses_yield_1");

    releaseYieldGate();
    await waitFor(() => {
      expectSetThreadsDispatched(dispatch, "ws-1", [
        { id: "gemini:ses_yield_1" },
      ]);
    });
  });

  it("commits straight through when no input is pending", async () => {
    yieldGate.mode = "immediate";
    vi.mocked(listGeminiSessions).mockResolvedValue([
      {
        sessionId: "ses_direct_1",
        firstMessage: "Direct",
        updatedAt: 1_730_000_200_000,
      },
    ] as never);

    const { result, dispatch } = renderActions();
    await act(async () =>
      result.current.listThreadsForWorkspace(workspace, {
        preserveState: true,
        startupHydrationMode: "full-catalog",
        includeEngineDiskLists: true,
      }),
    );

    // No manual release: the batch boundary passes through and the follow-up
    // merge commits on its own.
    await waitFor(() => {
      expectSetThreadsDispatched(dispatch, "ws-1", [
        { id: "gemini:ses_direct_1" },
      ]);
    });
    expect(yieldGate.calls).toBeGreaterThan(0);
  });

  it("drops the older parked apply when a newer request lands during the yield", async () => {
    yieldGate.mode = "blocked";
    vi.mocked(listGeminiSessions).mockResolvedValue([
      {
        sessionId: "ses_old",
        firstMessage: "Old",
        updatedAt: 1_730_000_300_000,
      },
    ] as never);

    const { result, dispatch } = renderActions();
    // Request A parks its gemini follow-up merge at the yield gate.
    await act(async () =>
      result.current.listThreadsForWorkspace(workspace, {
        preserveState: true,
        startupHydrationMode: "full-catalog",
        includeEngineDiskLists: true,
      }),
    );
    await waitFor(() => {
      expect(yieldGate.calls).toBe(1);
    });

    // A newer request lands while A is parked: it bumps the per-workspace
    // request seq synchronously, then abandons (soft-cancel / switch) without
    // dispatching anything itself.
    const abandoned = await act(async () =>
      result.current.listThreadsForWorkspace(workspace, {
        preserveState: true,
        startupHydrationMode: "full-catalog",
        includeEngineDiskLists: true,
        isStale: () => true,
      }),
    );
    expect(abandoned).toEqual({ applied: false, stale: true });

    // Releasing the gate must NOT commit A's older partial merge: the version
    // guard re-checked after the yield marks it stale.
    releaseYieldGate();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(appliedThreadIds(dispatch)).not.toContain("gemini:ses_old");
  });
});
