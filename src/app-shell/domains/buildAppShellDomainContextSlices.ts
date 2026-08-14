import type { AppShellDomainContextValue } from "./appShellDomainContexts";

/**
 * S4 PR-F：按域构造 context slice，避免在 AppShell 里继续「字母序切 bag」。
 * flatten 仍兼容 legacy 全量读侧；但 model / collab / runtimeThread 等干净域
 * 必须经这些 builder 进入 defineAppShellDomainContexts。
 */

/**
 * 会话热路径字段：回合生命周期 / token / plan / activeItems。
 * 从 workspaceNavigation / settings 大 bag 拆出，避免一次 isProcessing 抖动
 * 打坏 200+ key 的 shallow equal。
 */
export type RuntimeThreadSessionHotFields = {
  activeItems: unknown;
  activePlan: unknown;
  activeRateLimits: unknown;
  activeTokenUsage: unknown;
  activeTurnId: unknown;
  canInterrupt: unknown;
  isProcessing: unknown;
  isReviewing: unknown;
  timelinePlan: unknown;
};

export function buildRuntimeThreadDomainContextSlice(input: {
  legacyDefaults: AppShellDomainContextValue;
  runtimeActions: AppShellDomainContextValue;
  runtimeThreadBoundary: unknown;
  /** S4 PR-D：turn 级 conversation bags（history / thread list 分页 / parent 映射） */
  historyLoadingByThreadId: unknown;
  historyLoadingProgressByThreadId: unknown;
  historyRestoredAtMsByThread: unknown;
  threadListCursorByWorkspace: unknown;
  threadListPagingByWorkspace: unknown;
  threadParentById: unknown;
  /** S4 PR-C：conversation UI（rename/delete prompt / copy / hydration） */
  handleCopyThread: unknown;
  handleDeleteThreadPromptCancel: unknown;
  handleDeleteThreadPromptConfirm: unknown;
  handleRenamePromptCancel: unknown;
  handleRenamePromptChange: unknown;
  handleRenamePromptConfirm: unknown;
  handleRenameThread: unknown;
  hydratedThreadListWorkspaceIds: unknown;
  isDeleteThreadPromptBusy: unknown;
  /** S4 PR-C：review-prompt 流程（preset / branch / commit 选择） */
  choosePreset: unknown;
  handleReviewPromptKeyDown: unknown;
  handleSelectCommit: unknown;
  handleSelectStatusPanelSubagent: unknown;
  highlightedBranchIndex: unknown;
  highlightedCommitIndex: unknown;
  highlightedPresetIndex: unknown;
  /** S4 bag-split PR-1：高 churn 会话投影 */
  sessionHot?: RuntimeThreadSessionHotFields;
}): AppShellDomainContextValue {
  return {
    ...input.legacyDefaults,
    ...input.runtimeActions,
    runtimeThreadBoundary: input.runtimeThreadBoundary,
    historyLoadingByThreadId: input.historyLoadingByThreadId,
    historyLoadingProgressByThreadId: input.historyLoadingProgressByThreadId,
    historyRestoredAtMsByThread: input.historyRestoredAtMsByThread,
    threadListCursorByWorkspace: input.threadListCursorByWorkspace,
    threadListPagingByWorkspace: input.threadListPagingByWorkspace,
    threadParentById: input.threadParentById,
    handleCopyThread: input.handleCopyThread,
    handleDeleteThreadPromptCancel: input.handleDeleteThreadPromptCancel,
    handleDeleteThreadPromptConfirm: input.handleDeleteThreadPromptConfirm,
    handleRenamePromptCancel: input.handleRenamePromptCancel,
    handleRenamePromptChange: input.handleRenamePromptChange,
    handleRenamePromptConfirm: input.handleRenamePromptConfirm,
    handleRenameThread: input.handleRenameThread,
    hydratedThreadListWorkspaceIds: input.hydratedThreadListWorkspaceIds,
    isDeleteThreadPromptBusy: input.isDeleteThreadPromptBusy,
    choosePreset: input.choosePreset,
    handleReviewPromptKeyDown: input.handleReviewPromptKeyDown,
    handleSelectCommit: input.handleSelectCommit,
    handleSelectStatusPanelSubagent: input.handleSelectStatusPanelSubagent,
    highlightedBranchIndex: input.highlightedBranchIndex,
    highlightedCommitIndex: input.highlightedCommitIndex,
    highlightedPresetIndex: input.highlightedPresetIndex,
    ...(input.sessionHot ?? {}),
  };
}

export function buildModelSelectionDomainContextSlice(input: {
  effectiveModels: unknown;
  effectiveReasoningSupported: unknown;
  effectiveSelectedModel: unknown;
  effectiveSelectedModelId: unknown;
  providerModelCatalogs: unknown;
  reasoningOptions: unknown;
  reasoningSupported: unknown;
  refreshEngineModels: unknown;
  resolvedEffort: unknown;
  resolvedModel: unknown;
  selectedEffort: unknown;
  selectedModelId: unknown;
  setSelectedEffort: unknown;
  setSelectedModelId: unknown;
  /** S4 PR-C：模型/engine 选择动作（从 composerContext 归位） */
  availableEngines: unknown;
  handleOpenModelSettings: unknown;
  handleRefreshModelConfig: unknown;
  handleSelectModel: unknown;
  handleSelectOpenCodeAgent: unknown;
  handleSelectOpenCodeVariant: unknown;
  isModelConfigRefreshing: unknown;
}): AppShellDomainContextValue {
  return {
    effectiveModels: input.effectiveModels,
    effectiveReasoningSupported: input.effectiveReasoningSupported,
    effectiveSelectedModel: input.effectiveSelectedModel,
    effectiveSelectedModelId: input.effectiveSelectedModelId,
    providerModelCatalogs: input.providerModelCatalogs,
    reasoningOptions: input.reasoningOptions,
    reasoningSupported: input.reasoningSupported,
    refreshEngineModels: input.refreshEngineModels,
    resolvedEffort: input.resolvedEffort,
    resolvedModel: input.resolvedModel,
    selectedEffort: input.selectedEffort,
    selectedModelId: input.selectedModelId,
    setSelectedEffort: input.setSelectedEffort,
    setSelectedModelId: input.setSelectedModelId,
    availableEngines: input.availableEngines,
    handleOpenModelSettings: input.handleOpenModelSettings,
    handleRefreshModelConfig: input.handleRefreshModelConfig,
    handleSelectModel: input.handleSelectModel,
    handleSelectOpenCodeAgent: input.handleSelectOpenCodeAgent,
    handleSelectOpenCodeVariant: input.handleSelectOpenCodeVariant,
    isModelConfigRefreshing: input.isModelConfigRefreshing,
  };
}

export function buildCollaborationModeDomainContextSlice(input: {
  applySelectedCollaborationMode: unknown;
  collaborationModePayload: unknown;
  collaborationModes: unknown;
  collaborationModesEnabled: unknown;
  collaborationRuntimeModeByThread: unknown;
  collaborationUiModeByThread: unknown;
  handleCollaborationModeResolved: unknown;
  resolveCollaborationRuntimeMode: unknown;
  resolveCollaborationUiMode: unknown;
  selectedCollaborationMode: unknown;
  selectedCollaborationModeId: unknown;
  setCodexCollaborationMode: unknown;
  setCollaborationRuntimeModeByThread: unknown;
  setCollaborationUiModeByThread: unknown;
  setSelectedCollaborationModeId: unknown;
}): AppShellDomainContextValue {
  return {
    applySelectedCollaborationMode: input.applySelectedCollaborationMode,
    collaborationModePayload: input.collaborationModePayload,
    collaborationModes: input.collaborationModes,
    collaborationModesEnabled: input.collaborationModesEnabled,
    collaborationRuntimeModeByThread: input.collaborationRuntimeModeByThread,
    collaborationUiModeByThread: input.collaborationUiModeByThread,
    handleCollaborationModeResolved: input.handleCollaborationModeResolved,
    resolveCollaborationRuntimeMode: input.resolveCollaborationRuntimeMode,
    resolveCollaborationUiMode: input.resolveCollaborationUiMode,
    selectedCollaborationMode: input.selectedCollaborationMode,
    selectedCollaborationModeId: input.selectedCollaborationModeId,
    setCodexCollaborationMode: input.setCodexCollaborationMode,
    setCollaborationRuntimeModeByThread:
      input.setCollaborationRuntimeModeByThread,
    setCollaborationUiModeByThread: input.setCollaborationUiModeByThread,
    setSelectedCollaborationModeId: input.setSelectedCollaborationModeId,
  };
}

export function buildRuntimeDomainContextSlice(input: {
  runtimeRunState: unknown;
}): AppShellDomainContextValue {
  return {
    runtimeRunState: input.runtimeRunState,
  };
}

/**
 * T1.2：会话 / workspace 身份标识（从 workspaceNavigation 垃圾桶拆出）。
 * 只含 id / ref / 当前实体投影；不含 git / catalog / mode 路由。
 */
export type SessionIdentityDomainFields = {
  RECENT_THREAD_LIMIT: unknown;
  activeParentWorkspace: unknown;
  activePath: unknown;
  activeThreadId: unknown;
  activeThreadIdForModeRef: unknown;
  activeThreadIdRef: unknown;
  activeWorkspace: unknown;
  activeWorkspaceId: unknown;
  activeWorkspaceIdRef: unknown;
  activeWorkspaceRef: unknown;
  activeWorkspaceThreads: unknown;
  baseWorkspaceRef: unknown;
};

export function buildSessionIdentityDomainContextSlice(
  input: SessionIdentityDomainFields,
): AppShellDomainContextValue {
  return {
    RECENT_THREAD_LIMIT: input.RECENT_THREAD_LIMIT,
    activeParentWorkspace: input.activeParentWorkspace,
    activePath: input.activePath,
    activeThreadId: input.activeThreadId,
    activeThreadIdForModeRef: input.activeThreadIdForModeRef,
    activeThreadIdRef: input.activeThreadIdRef,
    activeWorkspace: input.activeWorkspace,
    activeWorkspaceId: input.activeWorkspaceId,
    activeWorkspaceIdRef: input.activeWorkspaceIdRef,
    activeWorkspaceRef: input.activeWorkspaceRef,
    activeWorkspaceThreads: input.activeWorkspaceThreads,
    baseWorkspaceRef: input.baseWorkspaceRef,
  };
}


/**
 * T1.3：workspace 目录 / 分组 / clone·worktree 入口（从 workspaceNavigation 拆出）。
 * 不含 session identity、git surface、mode routing。
 */
export type WorkspaceCatalogDomainFields = {
  addCloneAgent: unknown;
  addWorkspace: unknown;
  addWorkspaceFromPath: unknown;
  addWorktreeAgent: unknown;
  assignWorkspaceGroup: unknown;
  cancelClonePrompt: unknown;
  cancelWorktreePrompt: unknown;
  chooseCloneCopiesFolder: unknown;
  clearCloneCopiesFolder: unknown;
  clonePrompt: unknown;
  closeWorktreeCreateResult: unknown;
  confirmClonePrompt: unknown;
  confirmRenameWorktreeUpstream: unknown;
  confirmWorktreePrompt: unknown;
  connectWorkspace: unknown;
  createWorkspaceGroup: unknown;
  deleteWorkspaceGroup: unknown;
  deletingWorktreeIds: unknown;
  directories: unknown;
  directoryMetadata: unknown;
  ensureWorkspaceThreadListLoaded: unknown;
  forkThreadForWorkspace: unknown;
  forkSessionFromMessageForWorkspace: unknown;
  forkClaudeSessionFromMessageForWorkspace: unknown;
  getWorkspaceGroupName: unknown;
  getWorkspacePromptsDir: unknown;
  repositories: unknown;
  repositoriesLoading: unknown;
  isMultiRepository: unknown;
  /** S4 PR-C：workspace/agent 入口与拖放 intake（从 composerContext 归位） */
  groupedWorkspaces: unknown;
  handleAddAgent: unknown;
  handleAddCloneAgent: unknown;
  handleAddWorkspace: unknown;
  handleAddWorktreeAgent: unknown;
  handleArchiveActiveThread: unknown;
  handleEnsureWorkspaceThreadsForSettings: unknown;
  handleOpenNewWindow: unknown;
  handleWorkspaceDragEnter: unknown;
  handleWorkspaceDragLeave: unknown;
  handleWorkspaceDragOver: unknown;
  handleWorkspaceDrop: unknown;
};

export function buildWorkspaceCatalogDomainContextSlice(
  input: WorkspaceCatalogDomainFields,
): AppShellDomainContextValue {
  return {
    addCloneAgent: input.addCloneAgent,
    addWorkspace: input.addWorkspace,
    addWorkspaceFromPath: input.addWorkspaceFromPath,
    addWorktreeAgent: input.addWorktreeAgent,
    assignWorkspaceGroup: input.assignWorkspaceGroup,
    cancelClonePrompt: input.cancelClonePrompt,
    cancelWorktreePrompt: input.cancelWorktreePrompt,
    chooseCloneCopiesFolder: input.chooseCloneCopiesFolder,
    clearCloneCopiesFolder: input.clearCloneCopiesFolder,
    clonePrompt: input.clonePrompt,
    closeWorktreeCreateResult: input.closeWorktreeCreateResult,
    confirmClonePrompt: input.confirmClonePrompt,
    confirmRenameWorktreeUpstream: input.confirmRenameWorktreeUpstream,
    confirmWorktreePrompt: input.confirmWorktreePrompt,
    connectWorkspace: input.connectWorkspace,
    createWorkspaceGroup: input.createWorkspaceGroup,
    deleteWorkspaceGroup: input.deleteWorkspaceGroup,
    deletingWorktreeIds: input.deletingWorktreeIds,
    directories: input.directories,
    directoryMetadata: input.directoryMetadata,
    ensureWorkspaceThreadListLoaded: input.ensureWorkspaceThreadListLoaded,
    forkThreadForWorkspace: input.forkThreadForWorkspace,
    forkSessionFromMessageForWorkspace: input.forkSessionFromMessageForWorkspace,
    forkClaudeSessionFromMessageForWorkspace: input.forkClaudeSessionFromMessageForWorkspace,
    getWorkspaceGroupName: input.getWorkspaceGroupName,
    getWorkspacePromptsDir: input.getWorkspacePromptsDir,
    repositories: input.repositories,
    repositoriesLoading: input.repositoriesLoading,
    isMultiRepository: input.isMultiRepository,
    groupedWorkspaces: input.groupedWorkspaces,
    handleAddAgent: input.handleAddAgent,
    handleAddCloneAgent: input.handleAddCloneAgent,
    handleAddWorkspace: input.handleAddWorkspace,
    handleAddWorktreeAgent: input.handleAddWorktreeAgent,
    handleArchiveActiveThread: input.handleArchiveActiveThread,
    handleEnsureWorkspaceThreadsForSettings:
      input.handleEnsureWorkspaceThreadsForSettings,
    handleOpenNewWindow: input.handleOpenNewWindow,
    handleWorkspaceDragEnter: input.handleWorkspaceDragEnter,
    handleWorkspaceDragLeave: input.handleWorkspaceDragLeave,
    handleWorkspaceDragOver: input.handleWorkspaceDragOver,
    handleWorkspaceDrop: input.handleWorkspaceDrop,
  };
}


/**
 * T1.4：Git surface（diff/status/PR/branch/multi-repo ops）从 workspaceNavigation 拆出。
 * 禁止依赖 runtimeThread hot items。
 */
export type GitSurfaceDomainFields = {
  GitHubPanelData: unknown;
  activeDiffError: unknown;
  activeDiffLoading: unknown;
  activeDiffs: unknown;
  activeGitRoot: unknown;
  activeGitHistoryTabId: unknown;
  branchError: unknown;
  branches: unknown;
  checkoutBranch: unknown;
  clearGitOperationErrors: unknown;
  clearGitRootCandidates: unknown;
  commitError: unknown;
  commitLoading: unknown;
  commitMessage: unknown;
  commitMessageError: unknown;
  commitMessageLoading: unknown;
  confirmBranch: unknown;
  confirmCommit: unknown;
  createBranch: unknown;
  currentBranch: unknown;
  diffScrollRequestId: unknown;
  diffSource: unknown;
  exitDiffView: unknown;
  fileStatus: unknown;
  gitCommitDiffs: unknown;
  gitDiffListView: unknown;
  gitDiffViewStyle: unknown;
  gitHistoryPanelHeight: unknown;
  gitHistoryPanelHeightRef: unknown;
  gitIssues: unknown;
  gitIssuesError: unknown;
  gitIssuesLoading: unknown;
  gitIssuesTotal: unknown;
  gitLogAhead: unknown;
  gitLogAheadEntries: unknown;
  gitLogBehind: unknown;
  gitLogBehindEntries: unknown;
  gitLogEntries: unknown;
  gitLogError: unknown;
  gitLogLoading: unknown;
  gitLogTotal: unknown;
  gitLogUpstream: unknown;
  gitPanelMode: unknown;
  gitPullRequestComments: unknown;
  gitPullRequestCommentsError: unknown;
  gitPullRequestCommentsLoading: unknown;
  gitPullRequestDiffs: unknown;
  gitPullRequestDiffsError: unknown;
  gitPullRequestDiffsLoading: unknown;
  gitPullRequests: unknown;
  gitPullRequestsError: unknown;
  gitPullRequestsLoading: unknown;
  gitPullRequestsTotal: unknown;
  gitRemoteUrl: unknown;
  gitRootCandidates: unknown;
  gitRootScanDepth: unknown;
  gitRootScanError: unknown;
  gitRootScanHasScanned: unknown;
  gitRootScanLoading: unknown;
  gitStatus: unknown;
  gitignoredDirectories: unknown;
  gitignoredFiles: unknown;
  localBranches: unknown;
  remoteBranches: unknown;
  repositoryError: unknown;
  repositoryStatuses: unknown;
  repositoryStatusesLoading: unknown;
  refreshRepositoryStatuses: unknown;
  handleStageRepositoryFile: unknown;
  handleUnstageRepositoryFile: unknown;
  handleUnstageRepositoryAll: unknown;
  handleUnstageRepositoryFiles: unknown;
  handleRevertRepositoryFile: unknown;
  handleRevertRepositoryFiles: unknown;
  handleStageRepositoryAll: unknown;
  handleCommitRepositories: unknown;
  repositoryCommitSummary: unknown;
  selectRepository: unknown;
  selectedRepositoryRoot: unknown;
  /** S4 PR-C：git 操作 handlers 从 composerContext 归位（含 GitHub panel 变更回调） */
  handleActivateGitHistoryTab: unknown;
  handleActiveDiffPath: unknown;
  handleApplyWorktreeChanges: unknown;
  handleCheckoutBranch: unknown;
  handleCommit: unknown;
  handleCommitAndPush: unknown;
  handleCommitAndSync: unknown;
  handleCommitMessageChange: unknown;
  handleCreateBranch: unknown;
  handleGenerateCommitMessage: unknown;
  handleGitIssuesChange: unknown;
  handleGitPanelModeChange: unknown;
  handleGitPullRequestCommentsChange: unknown;
  handleGitPullRequestDiffsChange: unknown;
  handleGitPullRequestsChange: unknown;
  handlePickGitRoot: unknown;
  handlePush: unknown;
  handleRevertAllGitChanges: unknown;
  handleRevertGitFile: unknown;
  handleRevertGitPaths: unknown;
  handleSetGitRoot: unknown;
  handleStageGitAll: unknown;
  handleStageGitFile: unknown;
  handleSync: unknown;
  handleUnstageGitAll: unknown;
  handleUnstageGitFile: unknown;
  handleUnstageGitPaths: unknown;
  handleUpdateBranch: unknown;
  handleUpdateAllRepositories: unknown;
  handleCheckoutAllRepositories: unknown;
  handleLoadCommonRepositoryBranches: unknown;
};

export function buildGitSurfaceDomainContextSlice(
  input: GitSurfaceDomainFields,
): AppShellDomainContextValue {
  return {
    GitHubPanelData: input.GitHubPanelData,
    activeDiffError: input.activeDiffError,
    activeDiffLoading: input.activeDiffLoading,
    activeDiffs: input.activeDiffs,
    activeGitRoot: input.activeGitRoot,
    activeGitHistoryTabId: input.activeGitHistoryTabId,
    branchError: input.branchError,
    branches: input.branches,
    checkoutBranch: input.checkoutBranch,
    clearGitOperationErrors: input.clearGitOperationErrors,
    clearGitRootCandidates: input.clearGitRootCandidates,
    commitError: input.commitError,
    commitLoading: input.commitLoading,
    commitMessage: input.commitMessage,
    commitMessageError: input.commitMessageError,
    commitMessageLoading: input.commitMessageLoading,
    confirmBranch: input.confirmBranch,
    confirmCommit: input.confirmCommit,
    createBranch: input.createBranch,
    currentBranch: input.currentBranch,
    diffScrollRequestId: input.diffScrollRequestId,
    diffSource: input.diffSource,
    exitDiffView: input.exitDiffView,
    fileStatus: input.fileStatus,
    gitCommitDiffs: input.gitCommitDiffs,
    gitDiffListView: input.gitDiffListView,
    gitDiffViewStyle: input.gitDiffViewStyle,
    gitHistoryPanelHeight: input.gitHistoryPanelHeight,
    gitHistoryPanelHeightRef: input.gitHistoryPanelHeightRef,
    gitIssues: input.gitIssues,
    gitIssuesError: input.gitIssuesError,
    gitIssuesLoading: input.gitIssuesLoading,
    gitIssuesTotal: input.gitIssuesTotal,
    gitLogAhead: input.gitLogAhead,
    gitLogAheadEntries: input.gitLogAheadEntries,
    gitLogBehind: input.gitLogBehind,
    gitLogBehindEntries: input.gitLogBehindEntries,
    gitLogEntries: input.gitLogEntries,
    gitLogError: input.gitLogError,
    gitLogLoading: input.gitLogLoading,
    gitLogTotal: input.gitLogTotal,
    gitLogUpstream: input.gitLogUpstream,
    gitPanelMode: input.gitPanelMode,
    gitPullRequestComments: input.gitPullRequestComments,
    gitPullRequestCommentsError: input.gitPullRequestCommentsError,
    gitPullRequestCommentsLoading: input.gitPullRequestCommentsLoading,
    gitPullRequestDiffs: input.gitPullRequestDiffs,
    gitPullRequestDiffsError: input.gitPullRequestDiffsError,
    gitPullRequestDiffsLoading: input.gitPullRequestDiffsLoading,
    gitPullRequests: input.gitPullRequests,
    gitPullRequestsError: input.gitPullRequestsError,
    gitPullRequestsLoading: input.gitPullRequestsLoading,
    gitPullRequestsTotal: input.gitPullRequestsTotal,
    gitRemoteUrl: input.gitRemoteUrl,
    gitRootCandidates: input.gitRootCandidates,
    gitRootScanDepth: input.gitRootScanDepth,
    gitRootScanError: input.gitRootScanError,
    gitRootScanHasScanned: input.gitRootScanHasScanned,
    gitRootScanLoading: input.gitRootScanLoading,
    gitStatus: input.gitStatus,
    gitignoredDirectories: input.gitignoredDirectories,
    gitignoredFiles: input.gitignoredFiles,
    localBranches: input.localBranches,
    remoteBranches: input.remoteBranches,
    repositoryError: input.repositoryError,
    repositoryStatuses: input.repositoryStatuses,
    repositoryStatusesLoading: input.repositoryStatusesLoading,
    refreshRepositoryStatuses: input.refreshRepositoryStatuses,
    handleStageRepositoryFile: input.handleStageRepositoryFile,
    handleUnstageRepositoryFile: input.handleUnstageRepositoryFile,
    handleUnstageRepositoryAll: input.handleUnstageRepositoryAll,
    handleUnstageRepositoryFiles: input.handleUnstageRepositoryFiles,
    handleRevertRepositoryFile: input.handleRevertRepositoryFile,
    handleRevertRepositoryFiles: input.handleRevertRepositoryFiles,
    handleStageRepositoryAll: input.handleStageRepositoryAll,
    handleCommitRepositories: input.handleCommitRepositories,
    repositoryCommitSummary: input.repositoryCommitSummary,
    selectRepository: input.selectRepository,
    selectedRepositoryRoot: input.selectedRepositoryRoot,
    handleActivateGitHistoryTab: input.handleActivateGitHistoryTab,
    handleActiveDiffPath: input.handleActiveDiffPath,
    handleApplyWorktreeChanges: input.handleApplyWorktreeChanges,
    handleCheckoutBranch: input.handleCheckoutBranch,
    handleCommit: input.handleCommit,
    handleCommitAndPush: input.handleCommitAndPush,
    handleCommitAndSync: input.handleCommitAndSync,
    handleCommitMessageChange: input.handleCommitMessageChange,
    handleCreateBranch: input.handleCreateBranch,
    handleGenerateCommitMessage: input.handleGenerateCommitMessage,
    handleGitIssuesChange: input.handleGitIssuesChange,
    handleGitPanelModeChange: input.handleGitPanelModeChange,
    handleGitPullRequestCommentsChange:
      input.handleGitPullRequestCommentsChange,
    handleGitPullRequestDiffsChange: input.handleGitPullRequestDiffsChange,
    handleGitPullRequestsChange: input.handleGitPullRequestsChange,
    handlePickGitRoot: input.handlePickGitRoot,
    handlePush: input.handlePush,
    handleRevertAllGitChanges: input.handleRevertAllGitChanges,
    handleRevertGitFile: input.handleRevertGitFile,
    handleRevertGitPaths: input.handleRevertGitPaths,
    handleSetGitRoot: input.handleSetGitRoot,
    handleStageGitAll: input.handleStageGitAll,
    handleStageGitFile: input.handleStageGitFile,
    handleSync: input.handleSync,
    handleUnstageGitAll: input.handleUnstageGitAll,
    handleUnstageGitFile: input.handleUnstageGitFile,
    handleUnstageGitPaths: input.handleUnstageGitPaths,
    handleUpdateBranch: input.handleUpdateBranch,
    handleUpdateAllRepositories: input.handleUpdateAllRepositories,
    handleCheckoutAllRepositories: input.handleCheckoutAllRepositories,
    handleLoadCommonRepositoryBranches:
      input.handleLoadCommonRepositoryBranches,
  };
}


/**
 * T1.5：app/surface mode 路由（从 workspaceNavigation 拆出）。
 * 驱动 lazy surfaces；不反灌热会话投影。
 */
export type ModeRoutingDomainFields = {
  accessMode: unknown;
  activeTab: unknown;
  appMode: unknown;
  centerMode: unknown;
  claudeAccessModeRef: unknown;
  filePanelMode: unknown;
  /** S4 PR-C：UI 模式/面板路由与环境标志（从 composerContext 归位） */
  handleAppModeChange: unknown;
  handleDebugClick: unknown;
  handleLockPanel: unknown;
  handleResolvedClaudeThinkingVisibleChange: unknown;
  handleToggleRuntimeConsole: unknown;
  handleToggleTerminalPanel: unknown;
  handleUnlockPanel: unknown;
  hasActivePlan: unknown;
  isCompact: unknown;
  isMacDesktop: unknown;
  isPanelLocked: unknown;
  isPhone: unknown;
  isSearchPaletteOpen: unknown;
};

export function buildModeRoutingDomainContextSlice(
  input: ModeRoutingDomainFields,
): AppShellDomainContextValue {
  return {
    accessMode: input.accessMode,
    activeTab: input.activeTab,
    appMode: input.appMode,
    centerMode: input.centerMode,
    claudeAccessModeRef: input.claudeAccessModeRef,
    filePanelMode: input.filePanelMode,
    handleAppModeChange: input.handleAppModeChange,
    handleDebugClick: input.handleDebugClick,
    handleLockPanel: input.handleLockPanel,
    handleResolvedClaudeThinkingVisibleChange:
      input.handleResolvedClaudeThinkingVisibleChange,
    handleToggleRuntimeConsole: input.handleToggleRuntimeConsole,
    handleToggleTerminalPanel: input.handleToggleTerminalPanel,
    handleUnlockPanel: input.handleUnlockPanel,
    hasActivePlan: input.hasActivePlan,
    isCompact: input.isCompact,
    isMacDesktop: input.isMacDesktop,
    isPanelLocked: input.isPanelLocked,
    isPhone: input.isPhone,
    isSearchPaletteOpen: input.isSearchPaletteOpen,
  };
}


/**
 * T1.6：账号切换 / approvals 表面（从 workspaceNavigation 拆出）。
 */
export type AccountSurfaceDomainFields = {
  accountByWorkspace: unknown;
  accountSwitching: unknown;
  activeAccount: unknown;
  approvals: unknown;
  /** S4 PR-C：账号切换 / 审批 / 邮件会话入口（从 composerContext 归位） */
  handleApprovalBatchAccept: unknown;
  handleApprovalDecision: unknown;
  handleApprovalRemember: unknown;
  handleCancelSwitchAccount: unknown;
  handleOpenMailSession: unknown;
  handleSwitchAccount: unknown;
};

export function buildAccountSurfaceDomainContextSlice(
  input: AccountSurfaceDomainFields,
): AppShellDomainContextValue {
  return {
    accountByWorkspace: input.accountByWorkspace,
    accountSwitching: input.accountSwitching,
    activeAccount: input.activeAccount,
    approvals: input.approvals,
    handleApprovalBatchAccept: input.handleApprovalBatchAccept,
    handleApprovalDecision: input.handleApprovalDecision,
    handleApprovalRemember: input.handleApprovalRemember,
    handleCancelSwitchAccount: input.handleCancelSwitchAccount,
    handleOpenMailSession: input.handleOpenMailSession,
    handleSwitchAccount: input.handleSwitchAccount,
  };
}


/**
 * T1.7：dictation 表面（从 workspaceNavigation residual 拆出，达 navigation ≤80 门禁）。
 * 语义上贴近 composer；独立 domain 避免继续污染 navigation bag。
 */
export type DictationSurfaceDomainFields = {
  clearDictationError: unknown;
  clearDictationHint: unknown;
  clearDictationTranscript: unknown;
  dictationError: unknown;
  dictationHint: unknown;
  dictationLevel: unknown;
  dictationModel: unknown;
  dictationReady: unknown;
  dictationState: unknown;
  dictationTranscript: unknown;
  /** S4 PR-C：听写开关（从 composerContext 归位） */
  handleToggleDictation: unknown;
};

export function buildDictationSurfaceDomainContextSlice(
  input: DictationSurfaceDomainFields,
): AppShellDomainContextValue {
  return {
    clearDictationError: input.clearDictationError,
    clearDictationHint: input.clearDictationHint,
    clearDictationTranscript: input.clearDictationTranscript,
    dictationError: input.dictationError,
    dictationHint: input.dictationHint,
    dictationLevel: input.dictationLevel,
    dictationModel: input.dictationModel,
    dictationReady: input.dictationReady,
    dictationState: input.dictationState,
    dictationTranscript: input.dictationTranscript,
    handleToggleDictation: input.handleToggleDictation,
  };
}


/**
 * T1.9：workspaceNavigation residual 也走 dedicated builder，
 * 避免 defineAppShellDomainContexts 内继续内联大 object literal。
 */
export type WorkspaceNavigationDomainFields = {
  SettingsView: unknown;
  activeEditorFilePath: unknown;
  activeEditorLineRange: unknown;
  activeEngine: unknown;
  fileCompareSession: unknown;
  fileHistoryTabs: unknown;
  activeRenamePrompt: unknown;
  agentTaskScrollRequest: unknown;
  activeTerminalId: unknown;
  activeWorkspaceKanbanTasks: unknown;
  addDebugEntry: unknown;
  agent: unknown;
  alertError: unknown;
  appRootRef: unknown;
  appSettings: unknown;
  appSettingsLoading: unknown;
  claudeThinkingVisible: unknown;
  clearDebugEntries: unknown;
  clearDraftForThread: unknown;
  closePlanPanel: unknown;
  checkForUpdates: unknown;
  closeReleaseNotes: unknown;
  closeReviewPrompt: unknown;
  closeSettings: unknown;
  closeTerminalPanel: unknown;
  collapseRightPanel: unknown;
  collapseSidebar: unknown;
  commands: unknown;
  completionEmailIntentByThread: unknown;
  completionTrackerBySessionRef: unknown;
  completionTrackerReadyRef: unknown;
  confirmCustom: unknown;
  createPrompt: unknown;
  debugEntries: unknown;
  debugOpen: unknown;
  debugPanelHeight: unknown;
  deletePrompt: unknown;
  deleteThreadPrompt: unknown;
  dismissErrorToast: unknown;
  dismissUpdate: unknown;
  doctor: unknown;
  claudeDoctor: unknown;
  kimiDoctor: unknown;
  grokDoctor: unknown;
  opencodeDoctor: unknown;
  editorHighlightTarget: unknown;
  editorNavigationTarget: unknown;
  editorSplitCompanion: unknown;
  editorSplitLayout: unknown;
  engineModelsAsOptions: unknown;
  engineSelectedModelIdByType: unknown;
  engineStatuses: unknown;
  ensureLaunchTerminal: unknown;
  ensureTerminalWithTitle: unknown;
  errorToasts: unknown;
  expandRightPanel: unknown;
  expandSidebar: unknown;
  fileReferenceMode: unknown;
  fileTreeLoadError: unknown;
  fileTreeSourceVersion: unknown;
  files: unknown;
  getGlobalPromptsDir: unknown;
  getPinTimestamp: unknown;
  getThreadRows: unknown;
  globalSearchFilesByWorkspace: unknown;
  /** S4 PR-C：debug/updater 动作（从 composerContext 归位） */
  handleCopyDebug: unknown;
  handleTestNotificationSound: unknown;
};

export function buildWorkspaceNavigationDomainContextSlice(
  input: WorkspaceNavigationDomainFields,
): AppShellDomainContextValue {
  return {
    SettingsView: input.SettingsView,
    activeEditorFilePath: input.activeEditorFilePath,
    activeEditorLineRange: input.activeEditorLineRange,
    activeEngine: input.activeEngine,
    fileCompareSession: input.fileCompareSession,
    fileHistoryTabs: input.fileHistoryTabs,
    activeRenamePrompt: input.activeRenamePrompt,
    agentTaskScrollRequest: input.agentTaskScrollRequest,
    activeTerminalId: input.activeTerminalId,
    activeWorkspaceKanbanTasks: input.activeWorkspaceKanbanTasks,
    addDebugEntry: input.addDebugEntry,
    agent: input.agent,
    alertError: input.alertError,
    appRootRef: input.appRootRef,
    appSettings: input.appSettings,
    appSettingsLoading: input.appSettingsLoading,
    claudeThinkingVisible: input.claudeThinkingVisible,
    clearDebugEntries: input.clearDebugEntries,
    clearDraftForThread: input.clearDraftForThread,
    closePlanPanel: input.closePlanPanel,
    checkForUpdates: input.checkForUpdates,
    closeReleaseNotes: input.closeReleaseNotes,
    closeReviewPrompt: input.closeReviewPrompt,
    closeSettings: input.closeSettings,
    closeTerminalPanel: input.closeTerminalPanel,
    collapseRightPanel: input.collapseRightPanel,
    collapseSidebar: input.collapseSidebar,
    commands: input.commands,
    completionEmailIntentByThread: input.completionEmailIntentByThread,
    completionTrackerBySessionRef: input.completionTrackerBySessionRef,
    completionTrackerReadyRef: input.completionTrackerReadyRef,
    confirmCustom: input.confirmCustom,
    createPrompt: input.createPrompt,
    debugEntries: input.debugEntries,
    debugOpen: input.debugOpen,
    debugPanelHeight: input.debugPanelHeight,
    deletePrompt: input.deletePrompt,
    deleteThreadPrompt: input.deleteThreadPrompt,
    dismissErrorToast: input.dismissErrorToast,
    dismissUpdate: input.dismissUpdate,
    doctor: input.doctor,
    claudeDoctor: input.claudeDoctor,
    kimiDoctor: input.kimiDoctor,
    grokDoctor: input.grokDoctor,
    opencodeDoctor: input.opencodeDoctor,
    editorHighlightTarget: input.editorHighlightTarget,
    editorNavigationTarget: input.editorNavigationTarget,
    editorSplitCompanion: input.editorSplitCompanion,
    editorSplitLayout: input.editorSplitLayout,
    engineModelsAsOptions: input.engineModelsAsOptions,
    engineSelectedModelIdByType: input.engineSelectedModelIdByType,
    engineStatuses: input.engineStatuses,
    ensureLaunchTerminal: input.ensureLaunchTerminal,
    ensureTerminalWithTitle: input.ensureTerminalWithTitle,
    errorToasts: input.errorToasts,
    expandRightPanel: input.expandRightPanel,
    expandSidebar: input.expandSidebar,
    fileReferenceMode: input.fileReferenceMode,
    fileTreeLoadError: input.fileTreeLoadError,
    fileTreeSourceVersion: input.fileTreeSourceVersion,
    files: input.files,
    getGlobalPromptsDir: input.getGlobalPromptsDir,
    getPinTimestamp: input.getPinTimestamp,
    getThreadRows: input.getThreadRows,
    globalSearchFilesByWorkspace: input.globalSearchFilesByWorkspace,
    handleCopyDebug: input.handleCopyDebug,
    handleTestNotificationSound: input.handleTestNotificationSound,
  };
}
