import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRenderScheduler } from "../hooks/useRenderScheduler";
import type { MutableRefObject } from "react";
import type { WorkspaceInfo } from "../types";
import {
  startupOrchestrator,
  type StartupTaskDescriptor,
} from "../features/startup-orchestration/utils/startupOrchestrator";
import {
  getStartupTraceSnapshot,
  recordStartupMilestone,
  type StartupMilestoneName,
} from "../features/startup-orchestration/utils/startupTrace";
import {
  resolveNextWorkspaceThreadListHydrationId,
  shouldSkipWorkspaceThreadListLoad,
} from "./workspaceThreadListLoadGuard";

type ListThreadsForWorkspace = (
  workspace: WorkspaceInfo,
  options?: {
    preserveState?: boolean;
    includeOpenCodeSessions?: boolean;
    deletedThreadIds?: string[];
    startupHydrationMode?: "full-catalog" | "first-paint";
    allowRuntimeReconnect?: boolean;
    /** When true mid-flight, list apply must no-op (workspace cancelled/switched). */
    isStale?: () => boolean;
  },
) => Promise<void | { applied?: boolean; stale?: boolean }>;

type UseWorkspaceThreadListHydrationOptions = {
  activeWorkspaceId: string | null;
  activeWorkspaceProjectionOwnerIds: readonly string[];
  listThreadsForWorkspace: ListThreadsForWorkspace;
  threadListLoadingByWorkspace: Record<string, boolean>;
  workspaces: WorkspaceInfo[];
  workspacesById: Map<string, WorkspaceInfo>;
};

type UseWorkspaceThreadListHydrationResult = {
  ensureWorkspaceThreadListLoaded: (
    workspaceId: string,
    options?: {
      preserveState?: boolean;
      force?: boolean;
      deletedThreadIds?: string[];
    },
  ) => void;
  /** Immutable snapshot identity for UI (memo-safe). Prefer this over the ref for render props. */
  hydratedThreadListWorkspaceIds: ReadonlySet<string>;
  hydratedThreadListWorkspaceIdsRef: MutableRefObject<Set<string>>;
  listThreadsForWorkspaceTracked: ListThreadsForWorkspace;
  prewarmSessionRadarForWorkspace: (workspaceId: string) => void;
};

type ThreadHydrationPhase = "active-workspace" | "idle-prewarm" | "on-demand";
type ThreadHydrationKind = "full-catalog" | "session-radar" | "first-paint";

/** Delay before first active list so open + first clicks stay free (0.7.15 often skipped load via race). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const COLD_START_FIRST_PAINT_DELAY_MS =
  typeof import.meta !== "undefined" &&
  (import.meta as any).env?.MODE === "test"
    ? 0
    : 500;
function isDiscardedStaleHydrationResult(
  result: ThreadListHydrationResult,
): boolean {
  return (
    typeof result === "object" &&
    result !== null &&
    result.applied === false &&
    result.stale === true
  );
}

function hasRecordedActiveWorkspaceReady() {
  return Boolean(
    getStartupTraceSnapshot().milestones[ACTIVE_WORKSPACE_READY_MILESTONE],
  );
}

function createThreadHydrationTask(
  workspace: WorkspaceInfo,
  phase: ThreadHydrationPhase,
  kind: ThreadHydrationKind,
  run: (
    context: Parameters<
      StartupTaskDescriptor<ThreadListHydrationResult>["run"]
    >[0],
  ) => Promise<ThreadListHydrationResult>,
): StartupTaskDescriptor<ThreadListHydrationResult> {
  const dedupeKey = `thread-list:${kind}:${workspace.id}`;
  return {
    id: `thread-list:${kind}:${workspace.id}`,
    phase,
    priority:
      kind === "first-paint"
        ? 95
        : phase === "active-workspace"
          ? 90
          : phase === "on-demand"
            ? 85
            : kind === "session-radar"
              ? 30
              : 20,
    dedupeKey,
    concurrencyKey: "thread-session-scan",
    timeoutMs:
      kind === "first-paint"
        ? 8_000
        : phase === "active-workspace"
          ? 12_000
          : 20_000,
    workspaceScope: { workspaceId: workspace.id },
    // soft-ignore: timeout/cancel settle UI without hard-aborting native IPC,
    // but run() + list apply must honor isStale so late setThreads do not
    // storm the main thread after the user already moved on.
    cancelPolicy: "soft-ignore",
    traceLabel:
      kind === "session-radar"
        ? "session-radar workspace prewarm"
        : kind === "first-paint"
          ? "thread/list first-paint hydration"
          : `thread/list ${kind} hydration`,
    commandLabel: "list_threads",
    run,
    fallback: (reason) =>
      reason === "stale" ? { applied: false, stale: true } : undefined,
  };
}

function publishHydrationUiState(
  setHydrated: (next: Set<string>) => void,
  setCycle: (updater: (current: number) => number) => void,
  nextHydrated: Set<string>,
): void {
  // Hydration is background work: keep pointer/click updates urgent so the
  // shell stays interactive while the sidebar list is still refreshing.
  startTransition(() => {
    setHydrated(nextHydrated);
    setCycle((current) => current + 1);
  });
}

type ThreadListHydrationResult = void | { applied?: boolean; stale?: boolean };
const ACTIVE_WORKSPACE_READY_MILESTONE: StartupMilestoneName =
  "active-workspace-ready";
const IDLE_PREWARM_DELAY_MS = 120;

/**
 * Publish a new Set identity so memo(Sidebar) can see hydration progress.
 * Mutating a shared Set in place + setHydrationCycle alone is not enough:
 * layout passes the same Set reference into a memoized Sidebar and the
 * "加载中…" placeholder never leaves even after orchestrator timeout.
 */
function publishHydratedWorkspaceId(
  targetRef: MutableRefObject<Set<string>>,
  workspaceId: string,
): Set<string> {
  if (targetRef.current.has(workspaceId)) {
    return targetRef.current;
  }
  const next = new Set(targetRef.current);
  next.add(workspaceId);
  targetRef.current = next;
  return next;
}

export function useWorkspaceThreadListHydration({
  activeWorkspaceId,
  activeWorkspaceProjectionOwnerIds,
  listThreadsForWorkspace,
  threadListLoadingByWorkspace,
  workspaces,
  workspacesById,
}: UseWorkspaceThreadListHydrationOptions): UseWorkspaceThreadListHydrationResult {
  const hydratedThreadListWorkspaceIdsRef = useRef(new Set<string>());
  const fullyHydratedThreadListWorkspaceIdsRef = useRef(new Set<string>());
  const hydratingThreadListWorkspaceIdsRef = useRef(new Set<string>());
  const hydrationPhaseByWorkspaceIdRef = useRef(
    new Map<string, ThreadHydrationPhase>(),
  );
  const hydrationKindByWorkspaceIdRef = useRef(
    new Map<string, ThreadHydrationKind>(),
  );
  const autoHydratedActiveWorkspaceIdRef = useRef<string | null>(null);
  const previousActiveWorkspaceIdRef = useRef<string | null>(null);
  const ensureWorkspaceThreadListLoadedRef = useRef<
    | ((
        workspaceId: string,
        options?: {
          preserveState?: boolean;
          force?: boolean;
          deletedThreadIds?: string[];
        },
      ) => void)
    | null
  >(null);
  const idleHydrationCleanupByWorkspaceIdRef = useRef(new Map<string, () => void>());
  // State carries the published Set identity for consumers (Sidebar via layout).
  // Ref stays the sync source of truth for in-flight guards.
  const [hydratedThreadListWorkspaceIds, setHydratedThreadListWorkspaceIds] =
    useState<ReadonlySet<string>>(() => hydratedThreadListWorkspaceIdsRef.current);
  const [hydrationCycle, setHydrationCycle] = useState(0);
  const renderScheduler = useRenderScheduler({
    budgetMs: 0,
    idleTimeoutMs: IDLE_PREWARM_DELAY_MS,
  });
  const scheduleIdleHydration = useCallback(
    (callback: () => void): (() => void) => {
      let cancelled = false;
      renderScheduler.scheduleChunk(() => {
        if (cancelled) {
          return false;
        }
        callback();
        return false;
      });
      return () => {
        cancelled = true;
      };
    },
    [renderScheduler],
  );

  const backgroundHydrationWorkspaces = useMemo(() => {
    const priorityIds = new Set(activeWorkspaceProjectionOwnerIds);
    if (activeWorkspaceId) {
      priorityIds.add(activeWorkspaceId);
    }
    const priorityWorkspaces: WorkspaceInfo[] = [];
    const remainingWorkspaces: WorkspaceInfo[] = [];
    workspaces.forEach((workspace) => {
      if (priorityIds.has(workspace.id)) {
        priorityWorkspaces.push(workspace);
      } else {
        remainingWorkspaces.push(workspace);
      }
    });
    return [...priorityWorkspaces, ...remainingWorkspaces];
  }, [activeWorkspaceId, activeWorkspaceProjectionOwnerIds, workspaces]);

  const listThreadsForWorkspaceTracked = useCallback<ListThreadsForWorkspace>(
    async (workspace, options) => {
      hydratingThreadListWorkspaceIdsRef.current.add(workspace.id);
      const phase =
        hydrationPhaseByWorkspaceIdRef.current.get(workspace.id) ?? "on-demand";
      const kind =
        hydrationKindByWorkspaceIdRef.current.get(workspace.id) ??
        "full-catalog";
      let hydrationResult: ThreadListHydrationResult = undefined;
      const finishedKind = kind;
      try {
        const mode =
          kind === "first-paint" ? "first-paint" : "full-catalog";
        hydrationResult = await startupOrchestrator.run(
          createThreadHydrationTask(workspace, phase, kind, async (context) => {
            if (context.isStale()) {
              return { applied: false, stale: true };
            }
            return listThreadsForWorkspace(workspace, {
              ...options,
              startupHydrationMode: mode,
              allowRuntimeReconnect: false,
              isStale: context.isStale,
            });
          }),
        );
      } finally {
        const discardedAsStale =
          isDiscardedStaleHydrationResult(hydrationResult);
        if (
          !discardedAsStale &&
          (phase === "active-workspace" || finishedKind === "first-paint") &&
          !hasRecordedActiveWorkspaceReady()
        ) {
          recordStartupMilestone(ACTIVE_WORKSPACE_READY_MILESTONE);
        }
        // Timeout/fallback resolves as undefined (not stale). Publish a new Set
        // identity so memo(Sidebar) drops the loading placeholder even when the
        // underlying soft-ignore body is still finishing — but never do that for
        // stale/cancelled workspaces (would thrash the wrong shell).
        hydratingThreadListWorkspaceIdsRef.current.delete(workspace.id);
        hydrationPhaseByWorkspaceIdRef.current.delete(workspace.id);
        hydrationKindByWorkspaceIdRef.current.delete(workspace.id);
        if (!discardedAsStale) {
          // first-paint: clear sidebar "加载中" without claiming full multi-engine done.
          const nextHydrated = publishHydratedWorkspaceId(
            hydratedThreadListWorkspaceIdsRef,
            workspace.id,
          );
          if (finishedKind !== "first-paint") {
            publishHydratedWorkspaceId(
              fullyHydratedThreadListWorkspaceIdsRef,
              workspace.id,
            );
          }
          publishHydrationUiState(
            setHydratedThreadListWorkspaceIds,
            setHydrationCycle,
            nextHydrated,
          );
          if (finishedKind === "first-paint") {
            // Follow-up full catalog when the ensure path sees UI-hydrated but
            // not fully-hydrated (see ensureWorkspaceThreadListLoaded).
            window.setTimeout(() => {
              ensureWorkspaceThreadListLoadedRef.current?.(workspace.id, {
                preserveState: true,
              });
            }, 0);
          }
        } else {
          // Synchronous: background retry scheduling depends on this cycle tick
          // after a stale discard (must not wait behind startTransition).
          setHydrationCycle((current) => current + 1);
        }
      }
    },
    [listThreadsForWorkspace],
  );

  const ensureWorkspaceThreadListLoaded = useCallback(
    (
      workspaceId: string,
      options?: {
        preserveState?: boolean;
        force?: boolean;
        deletedThreadIds?: string[];
      },
    ) => {
      const workspace = workspacesById.get(workspaceId);
      if (!workspace) {
        return;
      }
      const force = options?.force ?? false;
      const isLoading = threadListLoadingByWorkspace[workspaceId] ?? false;
      const uiHydrated =
        hydratedThreadListWorkspaceIdsRef.current.has(workspaceId);
      const fullyHydrated =
        fullyHydratedThreadListWorkspaceIdsRef.current.has(workspaceId);
      // first-paint if UI never ready; else full-catalog until fully done.
      const kind: ThreadHydrationKind = force
        ? "full-catalog"
        : !uiHydrated
          ? "first-paint"
          : "full-catalog";
      const hasHydratedThreadList =
        kind === "first-paint" ? uiHydrated : fullyHydrated;
      const isHydratingThreadList =
        hydratingThreadListWorkspaceIdsRef.current.has(workspaceId);
      if (
        shouldSkipWorkspaceThreadListLoad({
          force,
          isLoading,
          isHydratingThreadList,
          hasHydratedThreadList,
        })
      ) {
        return;
      }
      const phase: ThreadHydrationPhase = force
        ? "on-demand"
        : workspaceId === activeWorkspaceId
          ? "active-workspace"
          : "idle-prewarm";
      hydrationPhaseByWorkspaceIdRef.current.set(workspaceId, phase);
      hydrationKindByWorkspaceIdRef.current.set(workspaceId, kind);
      void listThreadsForWorkspaceTracked(workspace, {
        preserveState: options?.preserveState,
        deletedThreadIds: options?.deletedThreadIds,
        startupHydrationMode:
          kind === "first-paint" ? "first-paint" : "full-catalog",
      });
    },
    [
      activeWorkspaceId,
      listThreadsForWorkspaceTracked,
      threadListLoadingByWorkspace,
      workspacesById,
    ],
  );

  ensureWorkspaceThreadListLoadedRef.current = ensureWorkspaceThreadListLoaded;

  const prewarmSessionRadarForWorkspace = useCallback(
    (workspaceId: string) => {
      const workspace = workspacesById.get(workspaceId);
      if (!workspace) {
        return;
      }
      if (threadListLoadingByWorkspace[workspaceId] ?? false) {
        return;
      }
      if (hydratingThreadListWorkspaceIdsRef.current.has(workspaceId)) {
        return;
      }
      if (fullyHydratedThreadListWorkspaceIdsRef.current.has(workspaceId)) {
        return;
      }
      if (idleHydrationCleanupByWorkspaceIdRef.current.has(workspaceId)) {
        return;
      }
      const cleanup = scheduleIdleHydration(() => {
        idleHydrationCleanupByWorkspaceIdRef.current.delete(workspaceId);
        if (threadListLoadingByWorkspace[workspaceId] ?? false) {
          return;
        }
        if (hydratingThreadListWorkspaceIdsRef.current.has(workspaceId)) {
          return;
        }
        if (fullyHydratedThreadListWorkspaceIdsRef.current.has(workspaceId)) {
          return;
        }
        hydrationPhaseByWorkspaceIdRef.current.set(workspaceId, "idle-prewarm");
        hydrationKindByWorkspaceIdRef.current.set(workspaceId, "session-radar");
        void listThreadsForWorkspaceTracked(workspace, {
          preserveState: true,
        });
      });
      idleHydrationCleanupByWorkspaceIdRef.current.set(workspaceId, cleanup);
    },
    [
      listThreadsForWorkspaceTracked,
      scheduleIdleHydration,
      threadListLoadingByWorkspace,
      workspacesById,
    ],
  );

  const prewarmFullCatalogForWorkspace = useCallback(
    (workspaceId: string) => {
      const workspace = workspacesById.get(workspaceId);
      if (!workspace) {
        return;
      }
      if (threadListLoadingByWorkspace[workspaceId] ?? false) {
        return;
      }
      if (hydratingThreadListWorkspaceIdsRef.current.has(workspaceId)) {
        return;
      }
      if (fullyHydratedThreadListWorkspaceIdsRef.current.has(workspaceId)) {
        return;
      }
      if (idleHydrationCleanupByWorkspaceIdRef.current.has(workspaceId)) {
        return;
      }
      const cleanup = scheduleIdleHydration(() => {
        idleHydrationCleanupByWorkspaceIdRef.current.delete(workspaceId);
        if (threadListLoadingByWorkspace[workspaceId] ?? false) {
          return;
        }
        if (hydratingThreadListWorkspaceIdsRef.current.has(workspaceId)) {
          return;
        }
        if (fullyHydratedThreadListWorkspaceIdsRef.current.has(workspaceId)) {
          return;
        }
        hydrationPhaseByWorkspaceIdRef.current.set(workspaceId, "idle-prewarm");
        hydrationKindByWorkspaceIdRef.current.set(workspaceId, "full-catalog");
        void listThreadsForWorkspaceTracked(workspace, {
          preserveState: true,
        });
      });
      idleHydrationCleanupByWorkspaceIdRef.current.set(workspaceId, cleanup);
    },
    [
      listThreadsForWorkspaceTracked,
      scheduleIdleHydration,
      threadListLoadingByWorkspace,
      workspacesById,
    ],
  );

  useEffect(() => {
    const previousActiveWorkspaceId = previousActiveWorkspaceIdRef.current;
    if (
      previousActiveWorkspaceId &&
      previousActiveWorkspaceId !== activeWorkspaceId
    ) {
      // Spec: stale workspace hydration is cancelled on switch. Soft-ignore
      // marks the generation stale so late list apply no-ops via isStale.
      startupOrchestrator.cancelWorkspaceTasks(
        previousActiveWorkspaceId,
        "stale",
      );
      const idleCleanup = idleHydrationCleanupByWorkspaceIdRef.current.get(
        previousActiveWorkspaceId,
      );
      if (idleCleanup) {
        idleCleanup();
        idleHydrationCleanupByWorkspaceIdRef.current.delete(
          previousActiveWorkspaceId,
        );
      }
    }
    previousActiveWorkspaceIdRef.current = activeWorkspaceId;

    if (!activeWorkspaceId) {
      autoHydratedActiveWorkspaceIdRef.current = null;
      return;
    }
    if (autoHydratedActiveWorkspaceIdRef.current === activeWorkspaceId) {
      return;
    }
    // Do not mark the active workspace as auto-hydrated until it exists in the
    // workspace map. On cold start activeWorkspaceId can land before workspacesById
    // is populated; marking early permanently skips ensure and leaves the sidebar
    // on "加载中…".
    if (!workspacesById.has(activeWorkspaceId)) {
      return;
    }
    // Defer first-paint list so cold-start clicks stay interactive. 0.7.15 often
    // skipped load via the workspacesById race; we keep correctness of 9e3c1bdd8
    // but do not start multi-engine work in the same frame as first paint.
    const targetId = activeWorkspaceId;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) {
        return;
      }
      if (autoHydratedActiveWorkspaceIdRef.current === targetId) {
        return;
      }
      autoHydratedActiveWorkspaceIdRef.current = targetId;
      ensureWorkspaceThreadListLoaded(targetId, { preserveState: true });
    }, COLD_START_FIRST_PAINT_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeWorkspaceId, ensureWorkspaceThreadListLoaded, workspacesById]);

  useEffect(() => {
    if (!activeWorkspaceId || activeWorkspaceProjectionOwnerIds.length <= 1) {
      return;
    }
    activeWorkspaceProjectionOwnerIds.forEach((workspaceId) => {
      if (workspaceId === activeWorkspaceId) {
        return;
      }
      if (!workspacesById.has(workspaceId)) {
        return;
      }
      ensureWorkspaceThreadListLoaded(workspaceId, { preserveState: true });
    });
  }, [
    activeWorkspaceId,
    activeWorkspaceProjectionOwnerIds,
    ensureWorkspaceThreadListLoaded,
    workspacesById,
  ]);

  const nextBackgroundWorkspaceThreadHydrationId =
    resolveNextWorkspaceThreadListHydrationId({
      workspaces: backgroundHydrationWorkspaces,
      activeWorkspaceProjectionOwnerIds:
        activeWorkspaceProjectionOwnerIds.filter(
          (workspaceId) => workspaceId !== activeWorkspaceId,
        ),
      hydratedWorkspaceIds: fullyHydratedThreadListWorkspaceIdsRef.current,
      hydratingWorkspaceIds: hydratingThreadListWorkspaceIdsRef.current,
      loadingByWorkspace: threadListLoadingByWorkspace,
    });

  void hydrationCycle;

  useEffect(() => {
    if (!nextBackgroundWorkspaceThreadHydrationId) {
      return;
    }
    // Do not stack idle full-catalog on top of the active workspace scan —
    // that overlap was the cold-start "any click freezes until list lands"
    // window. Skip while the active id is still in-flight; after settle/stale
    // the hydrating set clears and background can proceed (or retry).
    if (
      activeWorkspaceId &&
      hydratingThreadListWorkspaceIdsRef.current.has(activeWorkspaceId)
    ) {
      return;
    }
    prewarmFullCatalogForWorkspace(nextBackgroundWorkspaceThreadHydrationId);
  }, [
    activeWorkspaceId,
    nextBackgroundWorkspaceThreadHydrationId,
    prewarmFullCatalogForWorkspace,
    hydrationCycle,
  ]);

  useEffect(() => {
    const cleanupByWorkspaceId = idleHydrationCleanupByWorkspaceIdRef.current;
    return () => {
      cleanupByWorkspaceId.forEach((cleanup) => cleanup());
      cleanupByWorkspaceId.clear();
    };
  }, []);

  return {
    ensureWorkspaceThreadListLoaded,
    hydratedThreadListWorkspaceIds,
    hydratedThreadListWorkspaceIdsRef,
    listThreadsForWorkspaceTracked,
    prewarmSessionRadarForWorkspace,
  };
}
