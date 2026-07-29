import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";

import type { EngineType, ThreadSummary, WorkspaceInfo } from "../../../types";
import {
  createNativeProviderContinuation,
  discardPreparedNativeProviderContinuation,
  getOpenCodeProviderHealth,
  prepareNativeProviderContinuation,
  type NativeProviderContinuationInput,
} from "../../../services/tauri";
import {
  subscribeNativeProviderContinuationProgress,
  type NativeProviderContinuationProgressPhase,
} from "../../../services/events";
import { pushGlobalRuntimeNotice } from "../../../services/globalRuntimeNotices";
import { isEngineExecutionEnabled } from "../../../utils/engineExecutionPolicy";
import { formatByteSize } from "../../../utils/formatting";
import {
  clampRendererContextMenuPosition,
  type RendererContextMenuItem,
  type RendererContextMenuLeafItem,
  type RendererContextMenuState,
} from "../../../components/ui/RendererContextMenu";
import {
  buildClaudeResumeCommand,
  extractClaudeNativeSessionId,
  type ClaudeResumeCommandPlatform,
} from "../utils/claudeResumeCommand";
import type {
  EngineDisplayInfo,
  EngineRefreshResult,
} from "../../engine/hooks/useEngineController";
import {
  PINNABLE_WORKSPACE_ACTION_IDS,
  SIDEBAR_WORKSPACE_PINNED_ACTIONS_CHANGED_EVENT,
  readSidebarWorkspacePinnedActionIds,
  toggleSidebarWorkspacePinnedActionId,
} from "./useSidebarWorkspacePinnedActions";
import {
  CLAUDE_LOCAL_PROVIDER_PROFILE_ID,
  CLAUDE_LOCAL_PROVIDER_PROFILE_NAME,
  CODEX_DISK_PROVIDER_PROFILE_ID,
  CODEX_DISK_PROVIDER_PROFILE_NAME,
  GROK_LOCAL_PROVIDER_PROFILE_ID,
  GROK_LOCAL_PROVIDER_PROFILE_NAME,
  KIMI_LOCAL_PROVIDER_PROFILE_ID,
  KIMI_LOCAL_PROVIDER_PROFILE_NAME,
  OPENCODE_LOCAL_PROVIDER_PROFILE_ID,
  OPENCODE_LOCAL_PROVIDER_PROFILE_NAME,
  type EngineProviderProfileSelection,
  type EngineProviderProfileOption,
} from "../../threads/constants/codexProviderProfiles";
import {
  subscribeProviderContinuationDialogRequests,
  type ProviderContinuationDialogRequest,
} from "../../threads/services/providerContinuationRequests";
import { isWeakSessionDisplayTitle } from "../../threads/utils/sessionDisplayProjection";
import { toCanonicalProviderProfileSource } from "../../shared-session/target/types";

const LAST_PROVIDER_PROFILE_KEYS = {
  claude: "claudeLastProviderProfileId",
  codex: "codexLastProviderProfileId",
  kimi: "kimiLastProviderProfileId",
  grok: "grokLastProviderProfileId",
  opencode: "opencodeLastProviderProfileId",
} as const;
type ProviderEngine = keyof typeof LAST_PROVIDER_PROFILE_KEYS;

export type ProviderContinuationDialogState = {
  workspaceId: string;
  sourceSessionId: string;
  sourceTitle: string;
  sourceLabel: string;
  destinationLabel: string;
  request: NativeProviderContinuationInput;
  operationKey: string;
  stage: "preparing" | "confirm" | "running" | "error";
  retryAction: "prepare" | "execute" | null;
  detail: string | null;
  technicalDetail: string | null;
  sourceEstimatedTokens: number | null;
  packageEstimatedTokens: number | null;
  progressPhase: NativeProviderContinuationProgressPhase | null;
  progressPercent: number;
};

function providerContinuationRecoveryMessage(errorCode: string | null): string {
  if (
    errorCode?.includes("acceptance-ambiguous") ||
    errorCode?.includes("recovery-required")
  ) {
    return "目标会话可能已经创建。重试只会校验同一个会话，不会重复创建。";
  }
  if (errorCode?.includes("catalog-commit-failed")) {
    return "目标会话已创建，但客户端登记尚未完成。重试会补全登记。";
  }
  if (errorCode?.includes("artifact-integrity")) {
    return "续接上下文校验失败。来源会话未被修改，请重新发起续接。";
  }
  return "续接没有完成。来源会话保持不变，可以安全重试。";
}

const PINNABLE_WORKSPACE_ACTION_ID_SET = new Set<string>(
  PINNABLE_WORKSPACE_ACTION_IDS,
);

function readLastProviderProfileId(engine: ProviderEngine): string | null {
  try {
    return window.localStorage.getItem(LAST_PROVIDER_PROFILE_KEYS[engine]);
  } catch {
    return null;
  }
}

function writeLastProviderProfileId(engine: ProviderEngine, id: string) {
  try {
    window.localStorage.setItem(LAST_PROVIDER_PROFILE_KEYS[engine], id);
  } catch {
    // ignore storage write failures
  }
}

export type WorkspaceMenuIconKind =
  | "engine-claude"
  | "engine-codex"
  | "engine-opencode"
  | "engine-gemini"
  | "engine-kimi"
  | "engine-grok"
  | "new-shared"
  | "alias"
  | "activate"
  | "exited-sessions-hidden"
  | "exited-sessions-visible"
  | "new-folder"
  | "reload"
  | "remove"
  | "new-worktree"
  | "new-clone";

export type WorkspaceMenuAction = {
  id: string;
  label: string;
  iconKind: WorkspaceMenuIconKind;
  badgeLabel?: string;
  submenuTitle?: string;
  tone?: "default" | "danger";
  deprecated?: boolean;
  unavailable?: boolean;
  statusLabel?: string | null;
  refreshable?: boolean;
  refreshing?: boolean;
  selected?: boolean;
  keepMenuOpen?: boolean;
  pinnable?: boolean;
  pinned?: boolean;
  onTogglePinned?: () => void;
  /** Hint shown inside the submenu after one of its children is selected. */
  selectionHint?: string;
  onSelect: () => void;
  onRefresh?: () => Promise<void> | void;
  children?: WorkspaceMenuAction[];
};

export type WorkspaceMenuGroup = {
  id: string;
  label: string;
  actions: WorkspaceMenuAction[];
  collapsible?: boolean;
  defaultCollapsed?: boolean;
};

export type WorkspaceMenuState = {
  x: number;
  y: number;
  workspaceId: string;
  groups: WorkspaceMenuGroup[];
  workspace?: WorkspaceInfo;
  targetFolderId?: string | null;
};

export type SidebarContextMenuState = RendererContextMenuState & {
  source: "thread" | "worktree";
};

type SidebarMenuHandlers = {
  onAddAgent: (
    workspace: WorkspaceInfo,
    engine?: EngineType,
    options?: { folderId?: string | null } & EngineProviderProfileSelection,
  ) => Promise<string | null> | string | null | void;
  claudeProviderProfiles?: EngineProviderProfileOption[];
  codexProviderProfiles?: EngineProviderProfileOption[];
  kimiProviderProfiles?: EngineProviderProfileOption[];
  grokProviderProfiles?: EngineProviderProfileOption[];
  opencodeProviderProfiles?: EngineProviderProfileOption[];
  engineOptions?: EngineDisplayInfo[];
  onRefreshEngineOptions?: () =>
    | Promise<EngineRefreshResult | void>
    | EngineRefreshResult
    | void;
  onAddSharedAgent?: (workspace: WorkspaceInfo) => Promise<string | null> | string | null | void;
  onAssignNewSessionToFolder?: (
    workspaceId: string,
    threadId: string,
    folderId: string,
  ) => Promise<void> | void;
  onDeleteThread: (workspaceId: string, threadId: string) => void;
  onArchiveThread: (workspaceId: string, threadId: string) => void;
  onSyncThread: (workspaceId: string, threadId: string) => void;
  onPinThread: (workspaceId: string, threadId: string) => void;
  onUnpinThread: (workspaceId: string, threadId: string) => void;
  isThreadPinned: (workspaceId: string, threadId: string) => boolean;
  isThreadAutoNaming: (workspaceId: string, threadId: string) => boolean;
  onRenameThread: (workspaceId: string, threadId: string) => void;
  onAutoNameThread: (workspaceId: string, threadId: string) => void;
  onMoveThreadToFolder?: (
    workspaceId: string,
    threadId: string,
    folderId: string | null,
  ) => void;
  onOpenThreadFolderPicker?: (
    workspaceId: string,
    threadId: string,
    targets: ThreadMoveFolderTarget[],
    currentFolderId: string | null,
  ) => void;
  onOpenClaudeTui?: (input: {
    workspaceId: string;
    workspacePath: string;
    sessionId: string;
  }) => void;
  onReloadWorkspaceThreads: (
    workspaceId: string,
  ) => Promise<void> | void;
  onSelectThread: (workspaceId: string, threadId: string) => void;
  isThreadAvailable?: (workspaceId: string, threadId: string) => boolean;
  getThreadSummary?: (
    workspaceId: string,
    threadId: string,
  ) => ThreadSummary | undefined;
  onActivateWorkspace?: (workspaceId: string) => void;
  onCreateSessionFolder?: (workspaceId: string) => void;
  onToggleExitedSessions?: (workspacePath: string) => void;
  shouldShowExitedSessionsToggle?: (workspace: WorkspaceInfo) => boolean;
  isExitedSessionsHidden?: (workspacePath: string) => boolean;
  onDeleteWorkspace: (workspaceId: string) => void;
  onDeleteWorktree: (workspaceId: string) => void;
  onRenameWorkspaceAlias: (workspace: WorkspaceInfo) => void;
  onAddWorktreeAgent: (workspace: WorkspaceInfo) => void;
  onAddCloneAgent: (workspace: WorkspaceInfo) => void;
};

export type ThreadMoveFolderTarget = {
  folderId: string | null;
  label: string;
};

const INLINE_MOVE_FOLDER_TARGET_LIMIT = 12;

function resolveEngineDisplayName(engineType: EngineType): string {
  switch (engineType) {
    case "codex":
      return "Codex CLI";
    case "gemini":
      return "Gemini CLI";
    case "opencode":
      return "OpenCode";
    case "kimi":
      return "Kimi CLI";
    case "claude":
    default:
      return "Claude Code";
  }
}

export function useSidebarMenus({
  onAddAgent,
  engineOptions = [],
  onRefreshEngineOptions,
  onAddSharedAgent,
  onAssignNewSessionToFolder,
  onDeleteThread,
  onArchiveThread,
  onSyncThread,
  onPinThread,
  onUnpinThread,
  isThreadPinned,
  isThreadAutoNaming,
  onRenameThread,
  onAutoNameThread,
  onMoveThreadToFolder,
  onOpenThreadFolderPicker,
  onOpenClaudeTui,
  onReloadWorkspaceThreads,
  onSelectThread,
  isThreadAvailable,
  getThreadSummary,
  onActivateWorkspace,
  onCreateSessionFolder,
  onToggleExitedSessions,
  shouldShowExitedSessionsToggle,
  isExitedSessionsHidden,
  onDeleteWorkspace,
  onDeleteWorktree,
  onRenameWorkspaceAlias,
  onAddWorktreeAgent,
  onAddCloneAgent,
  claudeProviderProfiles = [],
  codexProviderProfiles = [],
  kimiProviderProfiles = [],
  grokProviderProfiles = [],
  opencodeProviderProfiles = [],
}: SidebarMenuHandlers) {
  const { t } = useTranslation();
  const [workspaceMenuState, setWorkspaceMenuState] =
    useState<WorkspaceMenuState | null>(null);
  const [sidebarContextMenuState, setSidebarContextMenuState] =
    useState<SidebarContextMenuState | null>(null);
  const [
    providerContinuationDialogState,
    setProviderContinuationDialogState,
  ] = useState<ProviderContinuationDialogState | null>(null);
  const [workspaceOpenCodeLoginState, setWorkspaceOpenCodeLoginState] = useState<
    Record<string, "loading" | "ready" | "requires-login">
  >({});
  const [workspaceEngineOverrides, setWorkspaceEngineOverrides] = useState<
    Record<string, EngineDisplayInfo>
  >({});
  const [workspaceEngineRefreshing, setWorkspaceEngineRefreshing] = useState<
    Record<string, boolean>
  >({});
  const workspaceOpenCodeLoginRequestIdRef = useRef<Record<string, number>>({});
  const workspaceEngineRefreshRequestIdRef = useRef<Record<string, number>>({});
  const providerContinuationOperationsRef = useRef(new Set<string>());
  const providerContinuationPreviewOperationsRef = useRef(new Set<string>());
  const canceledProviderContinuationOperationsRef = useRef(new Set<string>());
  const providerContinuationOperationIdsRef = useRef(new Map<string, string>());
  const providerContinuationDialogStateRef =
    useRef<ProviderContinuationDialogState | null>(null);
  const latestEngineOptionsRef = useRef(engineOptions);
  const [pinnedActionIds, setPinnedActionIds] = useState<string[]>(() =>
    readSidebarWorkspacePinnedActionIds(),
  );

  useEffect(() => {
    latestEngineOptionsRef.current = engineOptions;
  }, [engineOptions]);

  const replaceProviderContinuationDialog = useCallback(
    (next: ProviderContinuationDialogState | null) => {
      providerContinuationDialogStateRef.current = next;
      setProviderContinuationDialogState(next);
    },
    [],
  );

  const discardPreparedProviderContinuation = useCallback(
    async (dialog: ProviderContinuationDialogState) => {
      try {
        await discardPreparedNativeProviderContinuation(dialog.request);
      } catch (error) {
        console.warn(
          `[provider-continuation] failed to discard prepared operation ${dialog.request.operationId}`,
          error,
        );
      }
    },
    [],
  );

  useEffect(
    () =>
      subscribeNativeProviderContinuationProgress((event) => {
        const current = providerContinuationDialogStateRef.current;
        if (
          !current ||
          current.workspaceId !== event.workspaceId ||
          current.request.operationId !== event.operationId
        ) {
          return;
        }
        if (!Number.isFinite(event.percent)) {
          return;
        }
        const progressPercent = Math.min(
          100,
          Math.max(0, Math.round(event.percent)),
        );
        if (
          progressPercent < current.progressPercent ||
          (progressPercent === current.progressPercent &&
            event.phase === current.progressPhase)
        ) {
          return;
        }
        replaceProviderContinuationDialog({
          ...current,
          progressPhase: event.phase,
          progressPercent,
        });
      }),
    [replaceProviderContinuationDialog],
  );

  const beginProviderContinuationPreview = useCallback(
    async (dialog: ProviderContinuationDialogState) => {
      const operationId = dialog.request.operationId;
      if (
        providerContinuationPreviewOperationsRef.current.has(operationId)
      ) {
        return;
      }
      providerContinuationPreviewOperationsRef.current.add(operationId);
      const current = providerContinuationDialogStateRef.current;
      if (current?.request.operationId === operationId) {
        replaceProviderContinuationDialog({
          ...current,
          stage: "preparing",
          retryAction: null,
          detail: null,
          technicalDetail: null,
          progressPhase: "reading-source",
          progressPercent: 0,
        });
      }
      try {
        const result = await prepareNativeProviderContinuation(dialog.request);
        const latest = providerContinuationDialogStateRef.current;
        if (
          canceledProviderContinuationOperationsRef.current.has(operationId) ||
          latest?.request.operationId !== operationId
        ) {
          await discardPreparedProviderContinuation(dialog);
          canceledProviderContinuationOperationsRef.current.delete(operationId);
          return;
        }
        if (result.status !== "prepared") {
          throw new Error(
            `unexpected provider continuation preview status: ${result.status}`,
          );
        }
        replaceProviderContinuationDialog({
          ...latest,
          stage: "confirm",
          retryAction: null,
          detail: null,
          technicalDetail: null,
          sourceEstimatedTokens:
            typeof result.sourceEstimatedTokens === "number"
              ? result.sourceEstimatedTokens
              : null,
          packageEstimatedTokens:
            typeof result.packageEstimatedTokens === "number"
              ? result.packageEstimatedTokens
              : null,
          progressPhase: "prepared",
          progressPercent: Math.max(latest.progressPercent, 32),
        });
      } catch (error) {
        if (
          canceledProviderContinuationOperationsRef.current.has(operationId)
        ) {
          canceledProviderContinuationOperationsRef.current.delete(operationId);
          return;
        }
        const latest = providerContinuationDialogStateRef.current;
        if (latest?.request.operationId !== operationId) {
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        replaceProviderContinuationDialog({
          ...latest,
          stage: "error",
          retryAction: "prepare",
          detail: providerContinuationRecoveryMessage(message),
          technicalDetail: message,
        });
        pushGlobalRuntimeNotice({
          severity: "error",
          category: "user-action-error",
          messageKey: "runtimeNotice.error.threadTurnFailed",
          messageParams: {
            engine: dialog.destinationLabel,
            message,
          },
          dedupeKey: `provider-continuation-preview:${dialog.workspaceId}:${dialog.sourceSessionId}`,
        });
      } finally {
        providerContinuationPreviewOperationsRef.current.delete(operationId);
      }
    },
    [
      discardPreparedProviderContinuation,
      replaceProviderContinuationDialog,
    ],
  );

  const prepareProviderContinuationDialog = useCallback(
    (
      thread: ThreadSummary,
      request: ProviderContinuationDialogRequest,
    ) => {
      if (
        thread.threadKind === "shared" ||
        !thread.engineSource ||
        !["claude", "codex", "kimi"].includes(thread.engineSource)
      ) {
        return;
      }
      const sourceEngine = thread.engineSource as
        | "claude"
        | "codex"
        | "kimi";
      const nativeSessionId = thread.id.startsWith(`${sourceEngine}:`)
        ? thread.id.slice(sourceEngine.length + 1)
        : thread.id;
      const destinationProviderName =
        request.destination.providerProfileNameSnapshot?.trim() ||
        request.destination.providerProfileId;
      const destinationModel = request.destination.model?.trim();
      const guardKey = `${request.workspaceId}:${thread.id}`;
      const operationKey = [
        guardKey,
        request.destination.engine,
        request.destination.providerProfileId,
        destinationModel ?? "",
        request.destination.reasoningEffort?.trim() ?? "",
      ].join(":");
      const operationId =
        providerContinuationOperationIdsRef.current.get(operationKey) ??
        globalThis.crypto?.randomUUID?.() ??
        `continuation-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      providerContinuationOperationIdsRef.current.set(operationKey, operationId);
      const previous = providerContinuationDialogStateRef.current;
      if (previous?.stage === "running") {
        return;
      }
      if (previous) {
        const previousOperationId = previous.request.operationId;
        canceledProviderContinuationOperationsRef.current.add(previousOperationId);
        providerContinuationOperationIdsRef.current.delete(
          previous.operationKey,
        );
        void discardPreparedProviderContinuation(previous).finally(() => {
          if (
            !providerContinuationPreviewOperationsRef.current.has(
              previousOperationId,
            )
          ) {
            canceledProviderContinuationOperationsRef.current.delete(
              previousOperationId,
            );
          }
        });
      }
      const dialog: ProviderContinuationDialogState = {
        workspaceId: request.workspaceId,
        sourceSessionId: thread.id,
        sourceTitle:
          !isWeakSessionDisplayTitle(thread.name)
            ? (thread.name ?? "").trim()
            : t("threads.untitled", { defaultValue: "未命名会话" }),
        sourceLabel: `${resolveEngineDisplayName(sourceEngine)} · ${
          thread.providerProfileName ??
          thread.providerProfileId ??
          "本地配置"
        }`,
        destinationLabel: [
          resolveEngineDisplayName(request.destination.engine),
          destinationProviderName,
          destinationModel,
        ]
          .filter(Boolean)
          .join(" · "),
        request: {
          workspaceId: request.workspaceId,
          operationId,
          source: {
            sessionId: thread.id,
            nativeSessionId,
            engine: sourceEngine,
            providerProfileId: thread.providerProfileId ?? null,
          },
          destination: {
            ...request.destination,
            runtimeCapabilityFingerprint:
              request.destination.runtimeCapabilityFingerprint ??
              (request.destination.engine === "claude"
                ? "echo-checksum"
                : null),
          },
        },
        operationKey,
        stage: "preparing",
        retryAction: null,
        detail: null,
        technicalDetail: null,
        sourceEstimatedTokens: null,
        packageEstimatedTokens: null,
        progressPhase: "reading-source",
        progressPercent: 0,
      };
      replaceProviderContinuationDialog(dialog);
      void beginProviderContinuationPreview(dialog);
    },
    [
      beginProviderContinuationPreview,
      discardPreparedProviderContinuation,
      replaceProviderContinuationDialog,
      t,
    ],
  );

  useEffect(
    () =>
      subscribeProviderContinuationDialogRequests((request) => {
        const thread = getThreadSummary?.(
          request.workspaceId,
          request.sourceSessionId,
        );
        if (!thread) {
          pushGlobalRuntimeNotice({
            severity: "error",
            category: "user-action-error",
            messageKey: "runtimeNotice.error.threadTurnFailed",
            messageParams: {
              engine: resolveEngineDisplayName(request.destination.engine),
              message: t("threads.providerContinuationSourceUnavailable", {
                defaultValue: "来源会话已不可用",
              }),
            },
            dedupeKey: `provider-continuation-source:${request.workspaceId}:${request.sourceSessionId}`,
          });
          return;
        }
        prepareProviderContinuationDialog(thread, request);
      }),
    [getThreadSummary, prepareProviderContinuationDialog, t],
  );

  const closeProviderContinuationDialog = useCallback(() => {
    const current = providerContinuationDialogStateRef.current;
    if (!current || current.stage === "running") {
      return;
    }
    replaceProviderContinuationDialog(null);
    if (
      current.stage === "preparing" ||
      current.stage === "confirm" ||
      current.retryAction === "prepare"
    ) {
      const operationId = current.request.operationId;
      canceledProviderContinuationOperationsRef.current.add(operationId);
      providerContinuationOperationIdsRef.current.delete(current.operationKey);
      void discardPreparedProviderContinuation(current).finally(() => {
        if (
          !providerContinuationPreviewOperationsRef.current.has(operationId)
        ) {
          canceledProviderContinuationOperationsRef.current.delete(operationId);
        }
      });
    }
  }, [
    discardPreparedProviderContinuation,
    replaceProviderContinuationDialog,
  ]);

  const confirmProviderContinuation = useCallback(async () => {
    const dialog = providerContinuationDialogStateRef.current;
    if (!dialog || dialog.stage === "running" || dialog.stage === "preparing") {
      return;
    }
    if (dialog.stage === "error" && dialog.retryAction === "prepare") {
      await beginProviderContinuationPreview(dialog);
      return;
    }
    if (
      dialog.stage !== "confirm" &&
      !(dialog.stage === "error" && dialog.retryAction === "execute")
    ) {
      return;
    }
    const guardKey = `${dialog.workspaceId}:${dialog.sourceSessionId}`;
    if (providerContinuationOperationsRef.current.has(guardKey)) {
      return;
    }
    providerContinuationOperationsRef.current.add(guardKey);
    replaceProviderContinuationDialog({
      ...dialog,
      stage: "running",
      retryAction: null,
      detail: null,
      technicalDetail: null,
      progressPhase: "starting-target",
      progressPercent: Math.max(dialog.progressPercent, 45),
    });
    try {
      const result = await createNativeProviderContinuation({
        ...dialog.request,
        confirmDegraded: true,
      });
      if (result.status === "ready" && result.operation.resultSessionId) {
        providerContinuationOperationIdsRef.current.delete(dialog.operationKey);
        await onReloadWorkspaceThreads(dialog.workspaceId);
        replaceProviderContinuationDialog(null);
        onSelectThread(dialog.workspaceId, result.operation.resultSessionId);
        return;
      }
      const latest = providerContinuationDialogStateRef.current;
      if (latest?.request.operationId !== dialog.request.operationId) {
        return;
      }
      const errorCode =
        result.status === "confirmation-required"
          ? "unexpected-confirmation-required"
          : result.operation.errorCode ?? result.status;
      replaceProviderContinuationDialog({
        ...latest,
        stage: "error",
        retryAction: "execute",
        detail: providerContinuationRecoveryMessage(errorCode),
        technicalDetail: errorCode.trim() || null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const latest = providerContinuationDialogStateRef.current;
      if (latest?.request.operationId === dialog.request.operationId) {
        replaceProviderContinuationDialog({
          ...latest,
          stage: "error",
          retryAction: "execute",
          detail: providerContinuationRecoveryMessage(message),
          technicalDetail: message,
        });
      }
      pushGlobalRuntimeNotice({
        severity: "error",
        category: "user-action-error",
        messageKey: "runtimeNotice.error.threadTurnFailed",
        messageParams: {
          engine: dialog.destinationLabel,
          message,
        },
        dedupeKey: `provider-continuation:${dialog.workspaceId}:${dialog.sourceSessionId}`,
      });
    } finally {
      providerContinuationOperationsRef.current.delete(guardKey);
    }
  }, [
    beginProviderContinuationPreview,
    onReloadWorkspaceThreads,
    onSelectThread,
    replaceProviderContinuationDialog,
  ]);

  useEffect(() => {
    const handlePinnedActionsChanged = (event: Event) => {
      const next = (event as CustomEvent<unknown>).detail;
      if (!Array.isArray(next)) {
        return;
      }
      setPinnedActionIds(
        next.filter((id): id is string => typeof id === "string"),
      );
    };
    window.addEventListener(
      SIDEBAR_WORKSPACE_PINNED_ACTIONS_CHANGED_EVENT,
      handlePinnedActionsChanged,
    );
    return () => {
      window.removeEventListener(
        SIDEBAR_WORKSPACE_PINNED_ACTIONS_CHANGED_EVENT,
        handlePinnedActionsChanged,
      );
    };
  }, []);

  // 仅 PINNABLE_WORKSPACE_ACTION_IDS 里的动作出勾选框；其余菜单项返回空对象。
  const createRowPinMeta = useCallback(
    (id: string) => {
      if (!PINNABLE_WORKSPACE_ACTION_ID_SET.has(id)) {
        return {};
      }
      return {
        pinnable: true,
        pinned: pinnedActionIds.includes(id),
        onTogglePinned: () => {
          setPinnedActionIds(toggleSidebarWorkspacePinnedActionId(id));
        },
      };
    },
    [pinnedActionIds],
  );

  const isMatchingEngineInfo = useCallback(
    (left: EngineDisplayInfo, right: EngineDisplayInfo) =>
      left.type === right.type &&
      left.displayName === right.displayName &&
      left.shortName === right.shortName &&
      left.installed === right.installed &&
      left.version === right.version &&
      left.error === right.error &&
      left.availabilityState === right.availabilityState &&
      (left.availabilityLabelKey ?? null) === (right.availabilityLabelKey ?? null),
    [],
  );

  const closeWorkspaceMenu = useCallback(() => {
    setWorkspaceMenuState(null);
    setWorkspaceEngineOverrides({});
    setWorkspaceEngineRefreshing({});
  }, []);

  const closeSidebarContextMenu = useCallback(() => {
    setSidebarContextMenuState(null);
  }, []);

  useEffect(() => {
    if (Object.keys(workspaceEngineOverrides).length === 0) {
      return;
    }
    setWorkspaceEngineOverrides((prev) => {
      let changed = false;
      const next = { ...prev };

      Object.entries(prev).forEach(([workspaceEngineKey, override]) => {
        if (override.availabilityState === "loading") {
          return;
        }
        const engineType = workspaceEngineKey.slice(
          workspaceEngineKey.lastIndexOf(":") + 1,
        ) as EngineType;
        const engineInfo =
          engineOptions.find((entry) => entry.type === engineType) ?? null;
        if (engineInfo && isMatchingEngineInfo(override, engineInfo)) {
          delete next[workspaceEngineKey];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [engineOptions, isMatchingEngineInfo, workspaceEngineOverrides]);

  const onWorkspaceMenuAction = useCallback(
    (action: WorkspaceMenuAction) => {
      if (action.unavailable) {
        return;
      }
      if (!action.keepMenuOpen) {
        closeWorkspaceMenu();
      }
      action.onSelect();
    },
    [closeWorkspaceMenu],
  );

  const canResolveWorkspaceOpenCodeLoginState = useCallback(
    (workspace: WorkspaceInfo) => {
      const openCodeInfo = engineOptions.find((entry) => entry.type === "opencode") ?? null;
      return Boolean(
        workspace.connected && openCodeInfo?.availabilityState === "ready",
      );
    },
    [engineOptions],
  );

  const primeWorkspaceOpenCodeLoginState = useCallback(
    async (
      workspace: WorkspaceInfo,
      options?: {
        force?: boolean;
        bypassAvailabilityCheck?: boolean;
      },
    ) => {
      const force = options?.force ?? false;
      const bypassAvailabilityCheck =
        options?.bypassAvailabilityCheck ?? false;
      if (
        !bypassAvailabilityCheck &&
        !canResolveWorkspaceOpenCodeLoginState(workspace)
      ) {
        return;
      }
      const previousState = workspaceOpenCodeLoginState[workspace.id];
      if (!force && previousState) {
        return;
      }
      const requestId =
        (workspaceOpenCodeLoginRequestIdRef.current[workspace.id] ?? 0) + 1;
      workspaceOpenCodeLoginRequestIdRef.current[workspace.id] = requestId;
      setWorkspaceOpenCodeLoginState((prev) => ({
        ...prev,
        [workspace.id]: "loading",
      }));
      try {
        const providerHealth = await getOpenCodeProviderHealth(workspace.id, null);
        if (workspaceOpenCodeLoginRequestIdRef.current[workspace.id] !== requestId) {
          return;
        }
        setWorkspaceOpenCodeLoginState((prev) => ({
          ...prev,
          [workspace.id]: providerHealth.connected ? "ready" : "requires-login",
        }));
      } catch {
        if (workspaceOpenCodeLoginRequestIdRef.current[workspace.id] !== requestId) {
          return;
        }
        setWorkspaceOpenCodeLoginState((prev) => {
          const next = { ...prev };
          if (previousState) {
            next[workspace.id] = previousState;
          } else {
            delete next[workspace.id];
          }
          return next;
        });
      }
    },
    [
      canResolveWorkspaceOpenCodeLoginState,
      workspaceOpenCodeLoginState,
    ],
  );

  const getWorkspaceEngineKey = useCallback(
    (workspaceId: string, engineType: EngineType) => `${workspaceId}:${engineType}`,
    [],
  );

  const refreshSingleEngineState = useCallback(
    async (workspace: WorkspaceInfo, engineType: EngineType) => {
      const workspaceEngineKey = getWorkspaceEngineKey(workspace.id, engineType);
      const requestId =
        (workspaceEngineRefreshRequestIdRef.current[workspaceEngineKey] ?? 0) + 1;
      workspaceEngineRefreshRequestIdRef.current[workspaceEngineKey] = requestId;

      const fallbackEngineInfo =
        workspaceEngineOverrides[workspaceEngineKey] ??
        engineOptions.find((entry) => entry.type === engineType) ??
        null;

      setWorkspaceEngineRefreshing((prev) => ({
        ...prev,
        [workspaceEngineKey]: true,
      }));
      setWorkspaceEngineOverrides((prev) => ({
        ...prev,
        [workspaceEngineKey]: {
          type: engineType,
          displayName: fallbackEngineInfo?.displayName ?? engineType,
          shortName: fallbackEngineInfo?.shortName ?? engineType,
          installed: false,
          version: null,
          error: null,
          availabilityState: "loading",
          availabilityLabelKey: "workspace.engineStatusLoading",
        },
      }));
      pushGlobalRuntimeNotice({
        severity: "info",
        category: "diagnostic",
        messageKey: "runtimeNotice.engine.checking",
        messageParams: {
          engine:
            fallbackEngineInfo?.displayName ??
            resolveEngineDisplayName(engineType),
        },
        dedupeKey: `engine:${engineType}:checking`,
      });

      let resolvedOverride: EngineDisplayInfo | null = null;
      try {
        const refreshResult = await onRefreshEngineOptions?.();
        resolvedOverride =
          refreshResult?.availableEngines.find((entry) => entry.type === engineType) ??
          latestEngineOptionsRef.current.find((entry) => entry.type === engineType) ??
          null;
        if (engineType === "opencode" && workspace.connected) {
          await primeWorkspaceOpenCodeLoginState(workspace, {
            force: true,
            bypassAvailabilityCheck: true,
          });
        }
      } finally {
        if (workspaceEngineRefreshRequestIdRef.current[workspaceEngineKey] === requestId) {
          setWorkspaceEngineRefreshing((prev) => ({
            ...prev,
            [workspaceEngineKey]: false,
          }));
          setWorkspaceEngineOverrides((prev) => {
            if (resolvedOverride) {
              return {
                ...prev,
                [workspaceEngineKey]: resolvedOverride,
              };
            }
            const next = { ...prev };
            delete next[workspaceEngineKey];
            return next;
          });
        }
      }
    },
    [
      engineOptions,
      getWorkspaceEngineKey,
      onRefreshEngineOptions,
      primeWorkspaceOpenCodeLoginState,
      workspaceEngineOverrides,
    ],
  );

  const resolveEngineActionMeta = useCallback(
    (workspace: WorkspaceInfo, engineType: EngineType) => {
      const workspaceEngineKey = getWorkspaceEngineKey(workspace.id, engineType);
      const engineInfo =
        workspaceEngineOverrides[workspaceEngineKey] ??
        engineOptions.find((entry) => entry.type === engineType) ??
        null;
      const refreshing = workspaceEngineRefreshing[workspaceEngineKey] === true;
      const commonMeta = {
        refreshable: true,
        refreshing,
        onRefresh: () => refreshSingleEngineState(workspace, engineType),
      };
      if (!engineInfo) {
        return {
          unavailable: true,
          statusLabel: t("sidebar.cliNotInstalled"),
          ...commonMeta,
        };
      }

      if (engineInfo.availabilityState === "loading") {
        return {
          unavailable: true,
          statusLabel: t("workspace.engineStatusLoading"),
          ...commonMeta,
        };
      }

      if (engineInfo.availabilityState === "requires-login") {
        return {
          unavailable: true,
          statusLabel: t("workspace.engineStatusRequiresLogin"),
          ...commonMeta,
        };
      }

      if (engineInfo.availabilityState === "unavailable") {
        return {
          unavailable: true,
          statusLabel: t("sidebar.cliNotInstalled"),
          ...commonMeta,
        };
      }

      if (engineType === "opencode" && workspace.connected) {
        const workspaceScopedState = workspaceOpenCodeLoginState[workspace.id];
        if (workspaceScopedState === "loading") {
          return {
            unavailable: true,
            statusLabel: t("workspace.engineStatusLoading"),
            ...commonMeta,
          };
        }
        if (workspaceScopedState === "requires-login") {
          return {
            unavailable: true,
            statusLabel: t("workspace.engineStatusRequiresLogin"),
            ...commonMeta,
          };
        }
      }

      return {
        unavailable: false,
        statusLabel: null,
        ...commonMeta,
      };
    },
    [
      engineOptions,
      getWorkspaceEngineKey,
      refreshSingleEngineState,
      t,
      workspaceEngineOverrides,
      workspaceEngineRefreshing,
      workspaceOpenCodeLoginState,
    ],
  );

  const isEngineSessionEntryVisible = useCallback(
    (engineType: EngineType) => isEngineExecutionEnabled(engineType),
    [],
  );

  const [claudeSelectedProfileId, setClaudeSelectedProfileId] = useState<
    string | null
  >(() => readLastProviderProfileId("claude"));
  const [codexSelectedProfileId, setCodexSelectedProfileId] = useState<string | null>(
    () => readLastProviderProfileId("codex"),
  );
  const [kimiSelectedProfileId, setKimiSelectedProfileId] = useState<string | null>(
    () => readLastProviderProfileId("kimi"),
  );
  const [grokSelectedProfileId, setGrokSelectedProfileId] = useState<string | null>(
    () => readLastProviderProfileId("grok"),
  );
  const [opencodeSelectedProfileId, setOpencodeSelectedProfileId] = useState<string | null>(
    () => readLastProviderProfileId("opencode"),
  );

  const buildSessionMenuGroup = useCallback(
    (
      workspace: WorkspaceInfo,
      options?: { targetFolderId?: string | null },
    ): WorkspaceMenuGroup => {
      const targetFolderId = options?.targetFolderId?.trim() || null;
      const handleCreatedSession = async (threadId: string | null | void) => {
        if (!targetFolderId || !threadId) {
          return;
        }
        await onAssignNewSessionToFolder?.(workspace.id, threadId, targetFolderId);
      };
      const runAddAgent = (
        engine: EngineType,
        actionOptions?: EngineProviderProfileSelection,
      ) => {
        if (!isEngineExecutionEnabled(engine)) {
          return null;
        }
        if (actionOptions?.providerProfile?.availability === "unavailable") {
          return null;
        }
        const creationOptions = {
          ...(targetFolderId ? { folderId: targetFolderId } : {}),
          ...(actionOptions?.providerProfileId
            ? { providerProfileId: actionOptions.providerProfileId }
            : {}),
          ...(actionOptions?.providerProfile
            ? { providerProfile: actionOptions.providerProfile }
            : {}),
        };
        if (targetFolderId) {
          return onAddAgent(workspace, engine, creationOptions);
        }
        if (actionOptions?.providerProfileId || actionOptions?.providerProfile) {
          return onAddAgent(workspace, engine, creationOptions);
        }
        return onAddAgent(workspace, engine);
      };
      const buildProviderProfiles = (
        localId: string,
        localName: string,
        managedProfiles: EngineProviderProfileOption[],
        rememberedProfileId: string | null,
      ): EngineProviderProfileOption[] => {
        const profiles: EngineProviderProfileOption[] = [
          {
            id: localId,
            name: localName,
            source: "disk",
          },
          ...managedProfiles.filter(
            (profile) => profile.source === "managed" && profile.id !== localId,
          ),
        ];
        const rememberedId = rememberedProfileId?.trim() ?? "";
        if (
          rememberedId &&
          rememberedId !== localId &&
          !profiles.some((profile) => profile.id === rememberedId)
        ) {
          profiles.push({
            id: rememberedId,
            name: rememberedId,
            source: "managed",
            availability: "unavailable",
          });
        }
        return profiles;
      };
      const withProviderAvailability = (
        engineMeta: ReturnType<typeof resolveEngineActionMeta>,
        profile: EngineProviderProfileOption,
      ) =>
        profile.availability === "unavailable"
          ? {
              ...engineMeta,
              unavailable: true,
              statusLabel: t("sidebar.providerUnavailableLabel"),
            }
          : engineMeta;
      const claudeProfiles = buildProviderProfiles(
        CLAUDE_LOCAL_PROVIDER_PROFILE_ID,
        CLAUDE_LOCAL_PROVIDER_PROFILE_NAME,
        claudeProviderProfiles,
        claudeSelectedProfileId,
      );
      const codexProfiles = buildProviderProfiles(
        CODEX_DISK_PROVIDER_PROFILE_ID,
        CODEX_DISK_PROVIDER_PROFILE_NAME,
        codexProviderProfiles,
        codexSelectedProfileId,
      );
      const kimiProfiles = buildProviderProfiles(
        KIMI_LOCAL_PROVIDER_PROFILE_ID,
        KIMI_LOCAL_PROVIDER_PROFILE_NAME,
        kimiProviderProfiles,
        kimiSelectedProfileId,
      );
      const grokProfiles = buildProviderProfiles(
        GROK_LOCAL_PROVIDER_PROFILE_ID,
        GROK_LOCAL_PROVIDER_PROFILE_NAME,
        grokProviderProfiles,
        grokSelectedProfileId,
      );
      const opencodeProfiles = buildProviderProfiles(
        OPENCODE_LOCAL_PROVIDER_PROFILE_ID,
        OPENCODE_LOCAL_PROVIDER_PROFILE_NAME,
        opencodeProviderProfiles,
        opencodeSelectedProfileId,
      );
      const claudeSelectedProfile =
        claudeProfiles.find((profile) => profile.id === claudeSelectedProfileId) ??
        claudeProfiles[0];
      const codexSelectedProfile =
        codexProfiles.find((profile) => profile.id === codexSelectedProfileId) ??
        codexProfiles[0];
      const kimiSelectedProfile =
        kimiProfiles.find((profile) => profile.id === kimiSelectedProfileId) ??
        kimiProfiles[0];
      const grokSelectedProfile =
        grokProfiles.find((profile) => profile.id === grokSelectedProfileId) ??
        grokProfiles[0];
      const opencodeSelectedProfile =
        opencodeProfiles.find((profile) => profile.id === opencodeSelectedProfileId) ??
        opencodeProfiles[0];
      const actions = [
        {
          id: "new-session-shared",
          label: t("sidebar.newSharedSession"),
          iconKind: "new-shared",
          unavailable: !onAddSharedAgent,
          onSelect: async () => {
            const threadId = await onAddSharedAgent?.(workspace);
            await handleCreatedSession(threadId);
          },
        },
        {
          id: "new-session-claude",
          label: t("workspace.engineClaudeCode"),
          iconKind: "engine-claude",
          submenuTitle: t("sidebar.claudeProviderChoiceTitle"),
          selectionHint: t("sidebar.claudeProviderSelectedTip"),
          ...withProviderAvailability(
            resolveEngineActionMeta(workspace, "claude"),
            claudeSelectedProfile,
          ),
          onSelect: async () => {
            const threadId = await runAddAgent("claude", {
              providerProfileId: claudeSelectedProfile.id,
              providerProfile: claudeSelectedProfile,
            });
            await handleCreatedSession(threadId);
          },
          children: claudeProfiles.map((profile) => ({
            id: `new-session-claude-provider-${profile.id}`,
            label: profile.name,
            badgeLabel:
              profile.availability === "unavailable"
                ? t("sidebar.providerUnavailableLabel")
                : profile.source === "disk"
                ? t("sidebar.providerFollowsGlobalLabel")
                : t("sidebar.providerIsolatedConfigLabel"),
            iconKind: "engine-claude" as const,
            ...withProviderAvailability(
              resolveEngineActionMeta(workspace, "claude"),
              profile,
            ),
            selected: profile.id === claudeSelectedProfile.id,
            keepMenuOpen: true,
            onSelect: () => {
              writeLastProviderProfileId("claude", profile.id);
              setClaudeSelectedProfileId(profile.id);
              pushGlobalRuntimeNotice({
                severity: "info",
                category: "runtime",
                messageKey: "runtimeNotice.claude.providerSelected",
                messageParams: { name: profile.name },
                dedupeKey: `claude-provider-selected-${profile.id}`,
              });
            },
          })),
        },
        {
          id: "new-session-codex",
          label: t("workspace.engineCodex"),
          iconKind: "engine-codex",
          submenuTitle: t("sidebar.codexProviderChoiceTitle"),
          selectionHint: t("sidebar.codexProviderSelectedTip"),
          ...withProviderAvailability(
            resolveEngineActionMeta(workspace, "codex"),
            codexSelectedProfile,
          ),
          onSelect: async () => {
            const threadId = await runAddAgent("codex", {
              providerProfileId: codexSelectedProfile.id,
              providerProfile: codexSelectedProfile,
            });
            await handleCreatedSession(threadId);
          },
          children: codexProfiles.map((profile) => ({
            id: `new-session-codex-provider-${profile.id}`,
            label: profile.name,
            badgeLabel:
              profile.availability === "unavailable"
                ? t("sidebar.providerUnavailableLabel")
                : profile.source === "disk"
                ? t("sidebar.providerFollowsGlobalLabel")
                : t("sidebar.providerIsolatedConfigLabel"),
            iconKind: "engine-codex" as const,
            ...withProviderAvailability(
              resolveEngineActionMeta(workspace, "codex"),
              profile,
            ),
            selected: profile.id === codexSelectedProfile.id,
            keepMenuOpen: true,
            onSelect: () => {
              writeLastProviderProfileId("codex", profile.id);
              setCodexSelectedProfileId(profile.id);
              pushGlobalRuntimeNotice({
                severity: "info",
                category: "runtime",
                messageKey: "runtimeNotice.codex.providerSelected",
                messageParams: { name: profile.name },
                // Per-profile key: a same-key merge keeps the old notice's
                // messageParams, so a shared key would keep showing the
                // previous provider's name on consecutive picks.
                dedupeKey: `codex-provider-selected-${profile.id}`,
              });
            },
          })),
        },
        {
          id: "new-session-opencode",
          label: t("workspace.engineOpenCode"),
          iconKind: "engine-opencode",
          submenuTitle: t("sidebar.opencodeProviderChoiceTitle"),
          selectionHint: t("sidebar.opencodeProviderSelectedTip"),
          ...withProviderAvailability(
            resolveEngineActionMeta(workspace, "opencode"),
            opencodeSelectedProfile,
          ),
          onSelect: async () => {
            const threadId = await runAddAgent("opencode", {
              providerProfileId: opencodeSelectedProfile.id,
              providerProfile: opencodeSelectedProfile,
            });
            await handleCreatedSession(threadId);
          },
          children: opencodeProfiles.map((profile) => ({
            id: `new-session-opencode-provider-${profile.id}`,
            label: profile.name,
            badgeLabel:
              profile.availability === "unavailable"
                ? t("sidebar.providerUnavailableLabel")
                : profile.source === "disk"
                ? t("sidebar.providerFollowsGlobalLabel")
                : t("sidebar.providerIsolatedConfigLabel"),
            iconKind: "engine-opencode" as const,
            ...withProviderAvailability(
              resolveEngineActionMeta(workspace, "opencode"),
              profile,
            ),
            selected: profile.id === opencodeSelectedProfile.id,
            keepMenuOpen: true,
            onSelect: () => {
              writeLastProviderProfileId("opencode", profile.id);
              setOpencodeSelectedProfileId(profile.id);
              pushGlobalRuntimeNotice({
                severity: "info",
                category: "runtime",
                messageKey: "runtimeNotice.opencode.providerSelected",
                messageParams: { name: profile.name },
                dedupeKey: `opencode-provider-selected-${profile.id}`,
              });
            },
          })),
        },
        {
          id: "new-session-gemini",
          label: t("workspace.engineGemini"),
          iconKind: "engine-gemini",
          ...resolveEngineActionMeta(workspace, "gemini"),
          onSelect: async () => {
            const threadId = await runAddAgent("gemini");
            await handleCreatedSession(threadId);
          },
        },
        {
          id: "new-session-kimi",
          label: t("workspace.engineKimi"),
          iconKind: "engine-kimi",
          submenuTitle: t("sidebar.kimiProviderChoiceTitle"),
          selectionHint: t("sidebar.kimiProviderSelectedTip"),
          ...withProviderAvailability(
            resolveEngineActionMeta(workspace, "kimi"),
            kimiSelectedProfile,
          ),
          onSelect: async () => {
            const threadId = await runAddAgent("kimi", {
              providerProfileId: kimiSelectedProfile.id,
              providerProfile: kimiSelectedProfile,
            });
            await handleCreatedSession(threadId);
          },
          children: kimiProfiles.map((profile) => ({
            id: `new-session-kimi-provider-${profile.id}`,
            label: profile.name,
            badgeLabel:
              profile.availability === "unavailable"
                ? t("sidebar.providerUnavailableLabel")
                : profile.source === "disk"
                ? t("sidebar.providerFollowsGlobalLabel")
                : t("sidebar.providerIsolatedConfigLabel"),
            iconKind: "engine-kimi" as const,
            ...withProviderAvailability(
              resolveEngineActionMeta(workspace, "kimi"),
              profile,
            ),
            selected: profile.id === kimiSelectedProfile.id,
            keepMenuOpen: true,
            onSelect: () => {
              writeLastProviderProfileId("kimi", profile.id);
              setKimiSelectedProfileId(profile.id);
              pushGlobalRuntimeNotice({
                severity: "info",
                category: "runtime",
                messageKey: "runtimeNotice.kimi.providerSelected",
                messageParams: { name: profile.name },
                dedupeKey: `kimi-provider-selected-${profile.id}`,
              });
            },
          })),
        },
        {
          id: "new-session-grok",
          label: t("workspace.engineGrok"),
          iconKind: "engine-grok",
          submenuTitle: t("sidebar.grokProviderChoiceTitle"),
          selectionHint: t("sidebar.grokProviderSelectedTip"),
          ...withProviderAvailability(
            resolveEngineActionMeta(workspace, "grok"),
            grokSelectedProfile,
          ),
          onSelect: async () => {
            const threadId = await runAddAgent("grok", {
              providerProfileId: grokSelectedProfile.id,
              providerProfile: grokSelectedProfile,
            });
            await handleCreatedSession(threadId);
          },
          children: grokProfiles.map((profile) => ({
            id: `new-session-grok-provider-${profile.id}`,
            label: profile.name,
            badgeLabel:
              profile.availability === "unavailable"
                ? t("sidebar.providerUnavailableLabel")
                : profile.source === "disk"
                ? t("sidebar.providerFollowsGlobalLabel")
                : t("sidebar.providerIsolatedConfigLabel"),
            iconKind: "engine-grok" as const,
            ...withProviderAvailability(
              resolveEngineActionMeta(workspace, "grok"),
              profile,
            ),
            selected: profile.id === grokSelectedProfile.id,
            keepMenuOpen: true,
            onSelect: () => {
              writeLastProviderProfileId("grok", profile.id);
              setGrokSelectedProfileId(profile.id);
              pushGlobalRuntimeNotice({
                severity: "info",
                category: "runtime",
                messageKey: "runtimeNotice.grok.providerSelected",
                messageParams: { name: profile.name },
                dedupeKey: `grok-provider-selected-${profile.id}`,
              });
            },
          })),
        },
      ] satisfies WorkspaceMenuAction[];

      const visibleActions = actions.filter((action) => {
        if (action.id === "new-session-opencode") {
          return isEngineSessionEntryVisible("opencode");
        }
        if (action.id === "new-session-gemini") {
          return isEngineSessionEntryVisible("gemini");
        }
        return true;
      });

      return {
        id: "new-session",
        label: t("sidebar.sessionActionsGroup"),
        actions: visibleActions,
      };
    },
    [
      t,
      onAddAgent,
      onAddSharedAgent,
      onAssignNewSessionToFolder,
      claudeProviderProfiles,
      claudeSelectedProfileId,
      codexProviderProfiles,
      codexSelectedProfileId,
      kimiProviderProfiles,
      kimiSelectedProfileId,
      grokProviderProfiles,
      grokSelectedProfileId,
      opencodeProviderProfiles,
      opencodeSelectedProfileId,
      resolveEngineActionMeta,
      isEngineSessionEntryVisible,
    ],
  );

  const resolveWorkspaceMenuPosition = useCallback((event: MouseEvent) => {
    const menuWidthEstimate = 328;
    const menuHeightEstimate = 420;
    const viewportPadding = 12;
    const maxX = Math.max(
      viewportPadding,
      window.innerWidth - menuWidthEstimate - viewportPadding,
    );
    const maxY = Math.max(
      viewportPadding,
      window.innerHeight - menuHeightEstimate - viewportPadding,
    );

    return {
      x: Math.min(Math.max(event.clientX, viewportPadding), maxX),
      y: Math.min(Math.max(event.clientY, viewportPadding), maxY),
    };
  }, []);

  const buildWorkspaceMenuGroup = useCallback(
    (workspace: WorkspaceInfo): WorkspaceMenuGroup => {
      const workspaceId = workspace.id;
      const hideExitedSessions = isExitedSessionsHidden?.(workspace.path) ?? false;
      const showExitedSessionsToggle =
        Boolean(onToggleExitedSessions) &&
        (shouldShowExitedSessionsToggle?.(workspace) ?? false);

      return {
        id: "workspace-actions",
        label: t("sidebar.workspaceActionsGroup"),
        collapsible: true,
        defaultCollapsed: true,
        actions: [
          ...(onActivateWorkspace
            ? [
                {
                  id: "activate-workspace",
                  label: t("sidebar.activateWorkspace"),
                  iconKind: "activate" as const,
                  ...createRowPinMeta("activate-workspace"),
                  onSelect: () => onActivateWorkspace(workspaceId),
                },
              ]
            : []),
          {
            id: "reload-threads",
            label: t("threads.reloadThreads"),
            iconKind: "reload",
            ...createRowPinMeta("reload-threads"),
            onSelect: () => onReloadWorkspaceThreads(workspaceId),
          },
          ...(showExitedSessionsToggle && onToggleExitedSessions
            ? [
                {
                  id: "toggle-exited-sessions",
                  label: hideExitedSessions
                    ? t("threads.showExitedSessions")
                    : t("threads.hideExitedSessions"),
                  iconKind: hideExitedSessions
                    ? ("exited-sessions-hidden" as const)
                    : ("exited-sessions-visible" as const),
                  ...createRowPinMeta("toggle-exited-sessions"),
                  onSelect: () => onToggleExitedSessions(workspace.path),
                },
              ]
            : []),
          ...(onCreateSessionFolder
            ? [
                {
                  id: "create-session-folder",
                  label: t("sidebar.newSessionFolder"),
                  iconKind: "new-folder" as const,
                  ...createRowPinMeta("create-session-folder"),
                  onSelect: () => onCreateSessionFolder(workspaceId),
                },
              ]
            : []),
          {
            id: "rename-workspace-alias",
            label: t("sidebar.setWorkspaceAlias"),
            iconKind: "alias",
            ...createRowPinMeta("rename-workspace-alias"),
            onSelect: () => onRenameWorkspaceAlias(workspace),
          },
          {
            id: "remove-workspace",
            label: t("sidebar.removeWorkspace"),
            iconKind: "remove",
            tone: "danger",
            ...createRowPinMeta("remove-workspace"),
            onSelect: () => onDeleteWorkspace(workspaceId),
          },
          {
            id: "new-worktree-agent",
            label: t("sidebar.newWorktreeAgent"),
            iconKind: "new-worktree",
            ...createRowPinMeta("new-worktree-agent"),
            onSelect: () => onAddWorktreeAgent(workspace),
          },
          {
            id: "new-clone-agent",
            label: t("sidebar.newCloneAgent"),
            iconKind: "new-clone",
            deprecated: true,
            ...createRowPinMeta("new-clone-agent"),
            onSelect: () => onAddCloneAgent(workspace),
          },
        ],
      };
    },
    [
      t,
      createRowPinMeta,
      onReloadWorkspaceThreads,
      onActivateWorkspace,
      onCreateSessionFolder,
      onToggleExitedSessions,
      shouldShowExitedSessionsToggle,
      isExitedSessionsHidden,
      onDeleteWorkspace,
      onRenameWorkspaceAlias,
      onAddWorktreeAgent,
      onAddCloneAgent,
    ],
  );

  useEffect(() => {
    if (!workspaceMenuState?.workspace) {
      return;
    }
    setWorkspaceMenuState((prev) => {
      if (!prev?.workspace) {
        return prev;
      }
      const sessionGroup = buildSessionMenuGroup(prev.workspace, {
        targetFolderId: prev.targetFolderId,
      });
      const workspaceGroup = buildWorkspaceMenuGroup(prev.workspace);
      const nextGroups = prev.groups.map((group) =>
        group.id === "new-session"
          ? sessionGroup
          : group.id === "workspace-actions"
            ? workspaceGroup
            : group
      );
      const prevSignature = JSON.stringify(
        prev.groups.map((group) => ({
          id: group.id,
          actions: group.actions.map((action) => ({
            id: action.id,
            label: action.label,
            iconKind: action.iconKind,
            unavailable: action.unavailable,
            statusLabel: action.statusLabel ?? null,
            refreshing: action.refreshing ?? false,
            pinned: action.pinned ?? false,
            children: action.children?.map((child) => ({
              id: child.id,
              unavailable: child.unavailable,
              statusLabel: child.statusLabel ?? null,
              selected: child.selected ?? false,
            })) ?? null,
          })),
        })),
      );
      const nextSignature = JSON.stringify(
        nextGroups.map((group) => ({
          id: group.id,
          actions: group.actions.map((action) => ({
            id: action.id,
            label: action.label,
            iconKind: action.iconKind,
            unavailable: action.unavailable,
            statusLabel: action.statusLabel ?? null,
            refreshing: action.refreshing ?? false,
            pinned: action.pinned ?? false,
            children: action.children?.map((child) => ({
              id: child.id,
              unavailable: child.unavailable,
              statusLabel: child.statusLabel ?? null,
              selected: child.selected ?? false,
            })) ?? null,
          })),
        })),
      );
      if (prevSignature === nextSignature) {
        return prev;
      }
      return {
        ...prev,
        groups: nextGroups,
      };
    });
  }, [
    buildSessionMenuGroup,
    buildWorkspaceMenuGroup,
    workspaceMenuState?.workspace,
    workspaceOpenCodeLoginState,
  ]);

  const showThreadMenu = useCallback(
    (
      event: MouseEvent,
      workspaceId: string,
      threadId: string,
      canPin: boolean,
      sizeBytes?: number,
      moveFolderTargets: ThreadMoveFolderTarget[] = [],
      currentFolderId: string | null = null,
      canArchive: boolean = true,
      workspacePath: string = "",
    ) => {
      event.preventDefault();
      event.stopPropagation();
      const thread = getThreadSummary?.(workspaceId, threadId);
      const claudeSessionId = extractClaudeNativeSessionId(threadId);
      const isClaudeSession = Boolean(claudeSessionId);
      const claudeResumeCommand = claudeSessionId
        ? buildClaudeResumeCommand({
            workspacePath,
            sessionId: claudeSessionId,
            platform: navigator.userAgent.includes("Windows")
              ? "windows"
              : ("posix" satisfies ClaudeResumeCommandPlatform),
          })
        : null;
      const items: RendererContextMenuItem[] = [
        {
          type: "item",
          id: "rename",
          label: t("threads.rename"),
          onSelect: () => onRenameThread(workspaceId, threadId),
        },
      ];
      if (
        thread?.threadKind !== "shared" &&
        thread?.engineSource &&
        ["claude", "codex", "kimi"].includes(thread.engineSource)
      ) {
        const targetProviders = [
          ...claudeProviderProfiles.map((provider) => ({
            engine: "claude" as const,
            engineLabel: "Claude",
            provider,
          })),
          ...codexProviderProfiles.map((provider) => ({
            engine: "codex" as const,
            engineLabel: "Codex",
            provider,
          })),
        ].filter(
          ({ engine, provider }) =>
            provider.availability !== "unavailable" &&
            !(
              thread.engineSource === engine &&
              provider.id === thread.providerProfileId
            ),
        );
        const unavailableKimiTargets = (
          kimiProviderProfiles.length > 0
            ? kimiProviderProfiles
            : [
                {
                  id: KIMI_LOCAL_PROVIDER_PROFILE_ID,
                  name: KIMI_LOCAL_PROVIDER_PROFILE_NAME,
                  source: "disk" as const,
                },
              ]
        ).map((provider) => ({
          type: "item" as const,
          id: `continue-with-kimi-${provider.id}`,
          label: t("threads.providerContinuationKimiUnavailableWithProvider", {
            defaultValue: "Kimi CLI · {{provider}}（目标续接尚未验证）",
            provider: provider.name,
          }),
          disabled: true,
          onSelect: () => {},
        }));
        if (targetProviders.length > 0 || unavailableKimiTargets.length > 0) {
          items.push({
            type: "submenu",
            id: "continue-with-provider",
            label: t("threads.continueWithProvider", {
              defaultValue: "使用其他 Provider 继续",
            }),
            items: [
              ...targetProviders.map(({ engine, engineLabel, provider }) => ({
                type: "item" as const,
                id: `continue-with-${engine}-${provider.id}`,
                label: `${engineLabel} · ${provider.name}`,
                onSelect: () => {
                  prepareProviderContinuationDialog(thread, {
                    workspaceId,
                    sourceSessionId: thread.id,
                    destination: {
                      engine,
                      providerProfileId: provider.id,
                      providerProfileNameSnapshot: provider.name,
                      providerProfileSource: toCanonicalProviderProfileSource(
                        provider.source,
                        provider.source === "disk",
                      ),
                      runtimeCapabilityFingerprint:
                        engine === "claude" ? "echo-checksum" : null,
                    },
                  });
                },
              })),
              ...(targetProviders.length > 0 && unavailableKimiTargets.length > 0
                ? [
                    {
                      type: "separator" as const,
                      id: "continue-with-kimi-separator",
                    },
                    {
                      type: "label" as const,
                      id: "continue-with-kimi-status",
                      label: t("threads.providerContinuationKimiUnavailable", {
                        defaultValue: "Kimi CLI · 可作为来源，目标暂不可用",
                      }),
                    },
                  ]
                : []),
              ...unavailableKimiTargets,
            ],
          });
        }
      }
      if (
        thread?.originKind === "provider-continuation" &&
        thread.sourceSessionId
      ) {
        const sourceAvailable =
          isThreadAvailable?.(workspaceId, thread.sourceSessionId) ?? true;
        items.push({
          type: "item",
          id: "open-continuation-source",
          label: sourceAvailable
            ? t("threads.openContinuationSource", {
                defaultValue: "查看来源会话",
              })
            : t("threads.continuationSourceUnavailable", {
                defaultValue: "来源不可用",
              }),
          disabled: !sourceAvailable,
          onSelect: () =>
            onSelectThread(workspaceId, thread.sourceSessionId as string),
        });
      }
      const isAutoNamingNow = isThreadAutoNaming(workspaceId, threadId);
      items.push({
        type: "item",
        id: "auto-name",
        label: isAutoNamingNow ? t("threads.autoNaming") : t("threads.autoName"),
        onSelect: () => {
          if (isAutoNamingNow) {
            return;
          }
          onAutoNameThread(workspaceId, threadId);
        },
      });
      // Sync and archive are Codex-specific — skip for Claude sessions
      if (!isClaudeSession) {
        items.push({
          type: "item",
          id: "sync",
          label: t("threads.syncFromServer"),
          onSelect: () => onSyncThread(workspaceId, threadId),
        });
      }
      if (canPin) {
        const isPinned = isThreadPinned(workspaceId, threadId);
        items.push({
          type: "item",
          id: "pin",
          label: isPinned ? t("threads.unpin") : t("threads.pin"),
          onSelect: () => {
            if (isPinned) {
              onUnpinThread(workspaceId, threadId);
            } else {
              onPinThread(workspaceId, threadId);
            }
          },
        });
      }
      items.push({
        type: "item",
        id: "copy-id",
        label: t("threads.copyId"),
        onSelect: async () => {
          try {
            const copyId = claudeSessionId ?? threadId;
            await navigator.clipboard.writeText(copyId);
          } catch {
            // Clipboard failures are non-fatal here.
          }
        },
      });
      if (claudeSessionId && claudeResumeCommand) {
        if (onOpenClaudeTui) {
          items.push({
            type: "item",
            id: "open-claude-tui",
            label: t("threads.openClaudeTui"),
            onSelect: () =>
              onOpenClaudeTui({
                workspaceId,
                workspacePath,
                sessionId: claudeSessionId,
              }),
          });
        }
        items.push({
          type: "item",
          id: "copy-claude-resume-command",
          label: t("threads.copyClaudeResumeCommand"),
          onSelect: async () => {
            try {
              await navigator.clipboard.writeText(claudeResumeCommand);
              pushGlobalRuntimeNotice({
                severity: "info",
                category: "runtime",
                messageKey: "runtimeNotice.claude.resumeCommandCopied",
                messageParams: {
                  sessionId: claudeSessionId,
                },
                dedupeKey: `claude-resume-command-copied:${workspaceId}:${claudeSessionId}`,
              });
            } catch {
              // Clipboard failures are non-fatal here.
            }
          },
        });
        items.push({
          type: "label",
          id: "claude-resume-help",
          label: t("threads.claudeResumeCommandHelp"),
        });
      }
      if (canArchive) {
        items.push({
          type: "item",
          id: "archive",
          label: t("threads.archive"),
          onSelect: () => onArchiveThread(workspaceId, threadId),
        });
      }
      if (onMoveThreadToFolder && moveFolderTargets.length > 0) {
        const moveFolderItems: RendererContextMenuLeafItem[] = [];
        if (moveFolderTargets.length > INLINE_MOVE_FOLDER_TARGET_LIMIT && onOpenThreadFolderPicker) {
          moveFolderItems.push({
            type: "item",
            id: "search-folder-targets",
            label: t("threads.searchFolderTargets"),
            onSelect: () =>
              onOpenThreadFolderPicker(
                workspaceId,
                threadId,
                moveFolderTargets,
                currentFolderId,
              ),
          });
        }
        for (const target of moveFolderTargets) {
          const isCurrentTarget = (target.folderId ?? null) === (currentFolderId ?? null);
          moveFolderItems.push({
            type: "item",
            id: `move-folder-${target.folderId ?? "root"}`,
            label: target.label,
            disabled: isCurrentTarget,
            onSelect: () => onMoveThreadToFolder(workspaceId, threadId, target.folderId),
          });
        }
        items.push({
          type: "submenu",
          id: "move-to-folder",
          label: t("threads.moveToFolder"),
          items: moveFolderItems,
        });
      }
      const sizeLabel = formatByteSize(sizeBytes);
      if (sizeLabel) {
        items.push({
          type: "label",
          id: "size",
          label: `${t("threads.size")}: ${sizeLabel}`,
        });
      }
      items.push({
        type: "item",
        id: "delete",
        label: t("threads.delete"),
        tone: "danger",
        onSelect: () => onDeleteThread(workspaceId, threadId),
      });
      const position = clampRendererContextMenuPosition(event.clientX, event.clientY);
      setSidebarContextMenuState({
        ...position,
        label: t("threads.threadActions"),
        source: "thread",
        items,
      });
    },
    [
      t,
      isThreadPinned,
      isThreadAutoNaming,
      onArchiveThread,
      onDeleteThread,
      onOpenClaudeTui,
      onPinThread,
      onAutoNameThread,
      onMoveThreadToFolder,
      onOpenThreadFolderPicker,
      onRenameThread,
      onSyncThread,
      onUnpinThread,
      onSelectThread,
      claudeProviderProfiles,
      codexProviderProfiles,
      kimiProviderProfiles,
      isThreadAvailable,
      getThreadSummary,
      prepareProviderContinuationDialog,
    ],
  );

  const showWorkspaceMenu = useCallback(
    (event: MouseEvent, workspace: WorkspaceInfo) => {
      event.preventDefault();
      event.stopPropagation();
      const workspaceId = workspace.id;
      const { x, y } = resolveWorkspaceMenuPosition(event);

      const groups: WorkspaceMenuGroup[] = [
        buildSessionMenuGroup(workspace),
        buildWorkspaceMenuGroup(workspace),
      ];

      setWorkspaceMenuState({
        x,
        y,
        workspaceId,
        groups,
        workspace,
      });
    },
    [
      buildSessionMenuGroup,
      buildWorkspaceMenuGroup,
      resolveWorkspaceMenuPosition,
    ],
  );

  const showWorkspaceSessionMenu = useCallback(
    (
      event: MouseEvent,
      workspace: WorkspaceInfo,
      options?: { targetFolderId?: string | null },
    ) => {
      event.preventDefault();
      event.stopPropagation();
      const { x, y } = resolveWorkspaceMenuPosition(event);

      setWorkspaceMenuState({
        x,
        y,
        workspaceId: workspace.id,
        groups: [buildSessionMenuGroup(workspace, options)],
        workspace,
        targetFolderId: options?.targetFolderId?.trim() || null,
      });
    },
    [buildSessionMenuGroup, resolveWorkspaceMenuPosition],
  );

  const showWorktreeMenu = useCallback(
    (event: MouseEvent, workspaceId: string) => {
      event.preventDefault();
      event.stopPropagation();
      const position = clampRendererContextMenuPosition(event.clientX, event.clientY, {
        width: 240,
        height: 120,
      });
      setSidebarContextMenuState({
        ...position,
        label: t("sidebar.workspaceActionsGroup"),
        source: "worktree",
        items: [
          {
            type: "item",
            id: "reload",
            label: t("threads.reloadThreads"),
            onSelect: () => onReloadWorkspaceThreads(workspaceId),
          },
          {
            type: "item",
            id: "delete-worktree",
            label: t("threads.deleteWorktree"),
            tone: "danger",
            onSelect: () => onDeleteWorktree(workspaceId),
          },
        ],
      });
    },
    [t, onReloadWorkspaceThreads, onDeleteWorktree],
  );

  return {
    showThreadMenu,
    showWorkspaceMenu,
    showWorkspaceSessionMenu,
    showWorktreeMenu,
    workspaceMenuState,
    sidebarContextMenuState,
    providerContinuationDialogState,
    closeWorkspaceMenu,
    closeSidebarContextMenu,
    closeProviderContinuationDialog,
    confirmProviderContinuation,
    onWorkspaceMenuAction,
  };
}
