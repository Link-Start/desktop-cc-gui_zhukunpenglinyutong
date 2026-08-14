import { resolveIsSharedSession } from "../../features/shared-session/utils/sharedSessionIdentity";
import { useComposerController } from "../../features/app/hooks/useComposerController";
import { useComposerDomainHost } from "../domains/useComposerDomainHost";
import { useConversationDomainHost } from "../domains/useConversationDomainHost";
import { useCollaborationModeThreadSync } from "../domains/useCollaborationModeThreadSync";
import { useAppShellPromptActionsSection } from "../sections/useAppShellPromptActionsSection";
import { useCallback } from "react";
import { useHostFields, usePublishHostSlice } from "./appShellHostBus";

const SESSION_FIELDS = [
  "activeWorkspace",
  "activeWorkspaceId",
  "addDebugEntry",
  "appSettings",
  "appSettingsLoading",
  "composerInputRef",
  "queueSaveSettings",
  "setAppSettings",
  "settingsOpen",
  "t",
  "workspacesById",
  "connectWorkspace",
  "persistComposerEnginePref",
] as const;

const CATALOG_FIELDS = [
  "accessMode",
  "activeEngine",
  "activeThreadIdForModeRef",
  "applySelectedCollaborationMode",
  "codexComposerModeRef",
  "collaborationModes",
  "collaborationUiModeByThread",
  "composerSelectionResolverRef",
  "createPrompt",
  "deletePrompt",
  "engineModelCatalogsAsOptions",
  "engineModelsAsOptions",
  "getGlobalPromptsDir",
  "getWorkspacePromptsDir",
  "globalSelectionReady",
  "handleSetAccessMode",
  "installedEngines",
  "lastCodexModeSyncThreadRef",
  "models",
  "modelsReady",
  "movePrompt",
  "refreshEngineModels",
  "refreshModels",
  "resolveCollaborationRuntimeMode",
  "resolveCollaborationUiMode",
  "selectedCollaborationMode",
  "selectedCollaborationModeId",
  "setCodexCollaborationMode",
  "selectedEffort",
  "selectedModelId",
  "setActiveEngine",
  "setSelectedCollaborationModeId",
  "setSelectedEffort",
  "setSelectedModelId",
  "updatePrompt",
] as const;

const GIT_FIELDS = ["alertError"] as const;

const RUNTIME_FIELDS = [
  "activeItems",
  "activeThreadEngine",
  "activeThreadId",
  "activeThreadProviderProfileId",
  "activeThreadSummary",
  "activeTurnId",
  "handleFusionStalled",
  "handleUserInputSubmit",
  "hasPendingUserInput",
  "interruptTurn",
  "isProcessing",
  "isReviewing",
  "removeThread",
  "renameThread",
  "resolveCanonicalThreadId",
  "runtimeThreadBoundary",
  "sendUserMessage",
  "sendUserMessageToThread",
  "startCompact",
  "startContext",
  "startExport",
  "startFast",
  "startFork",
  "startImport",
  "startLsp",
  "startMcp",
  "startMode",
  "startResume",
  "startReview",
  "startShare",
  "startSpecRoot",
  "startStatus",
  "startThreadForWorkspace",
  "threadParentById",
  "threadStatusById",
  "threadsByWorkspace",
] as const;

/** 刀 1 / 刀 3：composer / conversation Host。 */
export function useAppShellComposerHost() {
  const session = useHostFields("session", SESSION_FIELDS);
  const catalog = useHostFields("catalog", CATALOG_FIELDS);
  const git = useHostFields("git", GIT_FIELDS);
  const runtime = useHostFields("runtime", RUNTIME_FIELDS);
  const activeWorkspace = session.activeWorkspace as any;
  const activeWorkspaceId = session.activeWorkspaceId as any;
  const addDebugEntry = session.addDebugEntry as any;
  const appSettings = session.appSettings as any;
  const appSettingsLoading = session.appSettingsLoading as any;
  const composerInputRef = session.composerInputRef as any;
  const queueSaveSettings = session.queueSaveSettings as any;
  const setAppSettings = session.setAppSettings as any;
  const settingsOpen = session.settingsOpen as any;
  const t = session.t as any;
  const workspacesById = session.workspacesById as any;
  const accessMode = catalog.accessMode as any;
  const activeEngine = catalog.activeEngine as any;
  const activeThreadIdForModeRef = catalog.activeThreadIdForModeRef as any;
  const applySelectedCollaborationMode = catalog.applySelectedCollaborationMode as any;
  const codexComposerModeRef = catalog.codexComposerModeRef as any;
  const collaborationModes = catalog.collaborationModes as any;
  const collaborationUiModeByThread = catalog.collaborationUiModeByThread as any;
  const composerSelectionResolverRef = catalog.composerSelectionResolverRef as any;
  const createPrompt = catalog.createPrompt as any;
  const deletePrompt = catalog.deletePrompt as any;
  const engineModelCatalogsAsOptions = catalog.engineModelCatalogsAsOptions as any;
  const engineModelsAsOptions = catalog.engineModelsAsOptions as any;
  const getGlobalPromptsDir = catalog.getGlobalPromptsDir as any;
  const getWorkspacePromptsDir = catalog.getWorkspacePromptsDir as any;
  const globalSelectionReady = catalog.globalSelectionReady as any;
  const handleSetAccessMode = catalog.handleSetAccessMode as any;
  const installedEngines = catalog.installedEngines as any;
  const lastCodexModeSyncThreadRef = catalog.lastCodexModeSyncThreadRef as any;
  const models = catalog.models as any;
  const modelsReady = catalog.modelsReady as any;
  const movePrompt = catalog.movePrompt as any;
  const persistComposerEnginePref = session.persistComposerEnginePref as any;
  const refreshEngineModels = catalog.refreshEngineModels as any;
  const refreshModels = catalog.refreshModels as any;
  const resolveCollaborationRuntimeMode = catalog.resolveCollaborationRuntimeMode as any;
  const resolveCollaborationUiMode = catalog.resolveCollaborationUiMode as any;
  const selectedCollaborationMode = catalog.selectedCollaborationMode as any;
  const selectedCollaborationModeId = catalog.selectedCollaborationModeId as any;
  const setCodexCollaborationMode = catalog.setCodexCollaborationMode as any;
  const selectedEffort = catalog.selectedEffort as any;
  const selectedModelId = catalog.selectedModelId as any;
  const setActiveEngine = catalog.setActiveEngine as any;
  const setSelectedCollaborationModeId = catalog.setSelectedCollaborationModeId as any;
  const setSelectedEffort = catalog.setSelectedEffort as any;
  const setSelectedModelId = catalog.setSelectedModelId as any;
  const updatePrompt = catalog.updatePrompt as any;
  const alertError = git.alertError as any;
  const connectWorkspace = session.connectWorkspace as any;
  const activeItems = runtime.activeItems as any;
  const activeThreadEngine = runtime.activeThreadEngine as any;
  const activeThreadId = runtime.activeThreadId as any;
  const activeThreadProviderProfileId = runtime.activeThreadProviderProfileId as any;
  const activeThreadSummary = runtime.activeThreadSummary as any;
  const activeTurnId = runtime.activeTurnId as any;
  const handleFusionStalled = runtime.handleFusionStalled as any;
  const handleUserInputSubmit = runtime.handleUserInputSubmit as any;
  const hasPendingUserInput = runtime.hasPendingUserInput as any;
  const interruptTurn = runtime.interruptTurn as any;
  const isProcessing = runtime.isProcessing as any;
  const isReviewing = runtime.isReviewing as any;
  const removeThread = runtime.removeThread as any;
  const renameThread = runtime.renameThread as any;
  const resolveCanonicalThreadId = runtime.resolveCanonicalThreadId as any;
  const runtimeThreadBoundary = runtime.runtimeThreadBoundary as any;
  const sendUserMessage = runtime.sendUserMessage as any;
  const sendUserMessageToThread = runtime.sendUserMessageToThread as any;
  const startCompact = runtime.startCompact as any;
  const startContext = runtime.startContext as any;
  const startExport = runtime.startExport as any;
  const startFast = runtime.startFast as any;
  const startFork = runtime.startFork as any;
  const startImport = runtime.startImport as any;
  const startLsp = runtime.startLsp as any;
  const startMcp = runtime.startMcp as any;
  const startMode = runtime.startMode as any;
  const startResume = runtime.startResume as any;
  const startReview = runtime.startReview as any;
  const startShare = runtime.startShare as any;
  const startSpecRoot = runtime.startSpecRoot as any;
  const startStatus = runtime.startStatus as any;
  const startThreadForWorkspace = runtime.startThreadForWorkspace as any;
  const threadParentById = runtime.threadParentById as any;
  const threadStatusById = runtime.threadStatusById as any;
  const threadsByWorkspace = runtime.threadsByWorkspace as any;

  const {
    persistComposerSelectionForThread,
    resolveComposerSelectionForThread,
    collaborationModePayload,
    effectiveModels,
    effectiveReasoningOptions,
    effectiveReasoningSupported,
    effectiveSelectedEffort,
    effectiveSelectedModel,
    effectiveSelectedModelId,
    engineSelectedModelIdByType,
    handleSelectComposerEffort,
    handleSelectModel,
    providerModelCatalogs,
    resolvedEffort,
    resolvedModel,
    selectedAgent,
    selectedAgentRef,
    handleSelectAgent,
    reloadAgentCatalog,
    handleRefreshModelConfig,
    isModelConfigRefreshing,
    handleUserInputSubmitWithPlanApply,
    handleExitPlanModeExecute,
  } = useComposerDomainHost({
    activeThreadId,
    activeWorkspaceId,
    activeThreadEngine,
    activeThreadEngineSource:
      activeThreadSummary?.engineSource ?? activeThreadSummary?.selectedEngine,
    activeThreadProviderProfileId,
    resolveCanonicalThreadId,
    appSettingsLoading,
    addDebugEntry,
    activeEngine,
    installedEngines,
    setActiveEngine,
    appSettings,
    accessMode,
    applySelectedCollaborationMode,
    collaborationModes,
    composerInputRef,
    composerSelectionResolverRef,
    engineModelCatalogsAsOptions,
    engineModelsAsOptions,
    globalSelectionReady,
    handleSetAccessMode,
    models,
    modelsReady,
    persistComposerEnginePref,
    queueSaveSettings,
    selectedCollaborationMode,
    selectedCollaborationModeId,
    selectedEffort,
    selectedModelId,
    setAppSettings,
    setSelectedEffort,
    setSelectedModelId,
    refreshEngineModels,
    refreshModels,
    handleUserInputSubmit,
    interruptTurn,
    resolveCollaborationRuntimeMode,
    resolveCollaborationUiMode,
    sendUserMessage,
    settingsOpen,
  });

  useCollaborationModeThreadSync({
    activeEngine,
    activeThreadId,
    activeThreadIdForModeRef,
    appSettingsLoading,
    codexComposerModeRef,
    collaborationUiModeByThread,
    lastCodexModeSyncThreadRef,
    selectedCollaborationModeId,
    setSelectedCollaborationModeId,
  });

  const {
    activeImages,
    attachImages,
    pickImages,
    removeImage,
    clearActiveImages,
    removeImagesForThread,
    activeQueue,
    activeQueuedHandoffBubble,
    handleSend,
    queueMessage,
    prefillDraft,
    setPrefillDraft,
    composerInsert,
    setComposerInsert,
    getActiveDraft,
    handleDraftChange,
    handleSendPrompt,
    handleEditQueued,
    handleDeleteQueued,
    handleFuseQueued,
    canFuseActiveQueue,
    fuseDisabledReasonKey,
    activeFusingMessageId,
    clearDraftForThread,
  } = useComposerController({
    activeThreadId,
    activeTurnId,
    activeContinuationPulse: activeThreadId
      ? (threadStatusById[activeThreadId]?.continuationPulse ?? 0)
      : 0,
    activeTerminalPulse: activeThreadId
      ? (threadStatusById[activeThreadId]?.terminalPulse ?? 0)
      : 0,
    activeWorkspaceId,
    activeWorkspace,
    isProcessing,
    isReviewing,
    isContextCompacting: activeThreadId
      ? (threadStatusById[activeThreadId]?.isContextCompacting ?? false)
      : false,
    hasPendingUserInput,
    threadStatusById,
    activeItems,
    resolveWorkspace: (workspaceId: string) =>
      workspacesById.get(workspaceId) ?? null,
    steerEnabled: appSettings.experimentalSteerEnabled,
    activeEngine,
    // 身份 id-first（fix-shared-session-identity-id-first）：
    // shared: 前缀是 hard gate，threadKind 投影仅兜底。
    isSharedSession: resolveIsSharedSession(activeThreadId, activeThreadSummary),
    resolveCanonicalThreadId,
    connectWorkspace,
    startThreadForWorkspace,
    sendUserMessage,
    sendUserMessageToThread,
    handleFusionStalled,
    startFork,
    startReview,
    startResume,
    startMcp,
    startSpecRoot,
    startStatus,
    startContext,
    startCompact,
    startFast,
    startMode,
    startExport,
    startImport,
    startLsp,
    startShare,
    setCodexCollaborationMode,
    getCodexCollaborationMode: () => {
      const threadMode = activeThreadId
        ? (collaborationUiModeByThread[activeThreadId] ?? null)
        : null;
      if (threadMode === "plan" || threadMode === "code") {
        return threadMode;
      }
      if (
        selectedCollaborationModeId === "plan" ||
        selectedCollaborationModeId === "code"
      ) {
        return selectedCollaborationModeId;
      }
      return "code";
    },
    getCodexCollaborationPayload: () => collaborationModePayload,
    interruptTurn,
  });

  // S4 PR-D：Conversation 域 host（须在 useComposerController 之后，依赖 clearDraft/removeImages）
  const {
    activeThreadIdRef,
    getThreadRows,
    handleCopyThread,
    renamePrompt,
    openRenamePrompt,
    handleRenamePromptChange,
    handleRenamePromptCancel,
    handleRenamePromptConfirm,
    deleteThreadPrompt,
    isDeleteThreadPromptBusy,
    openDeleteThreadPrompt,
    handleDeleteThreadPromptCancel,
    handleDeleteThreadPromptConfirm,
  } = useConversationDomainHost({
    runtimeThreadBoundary,
    activeThreadId,
    threadParentById,
    activeItems,
    threadsByWorkspace,
    renameThread,
    removeThread,
    clearDraftForThread,
    removeImagesForThread,
    alertError,
    deleteConversationFailedMessage: t("workspace.deleteConversationFailed"),
    addDebugEntry,
    reloadAgentCatalog,
    settingsOpen,
  });

  const handleRenameThread = useCallback(
    (workspaceId: string, threadId: string) => {
      openRenamePrompt(workspaceId, threadId);
    },
    [openRenamePrompt],
  );

  const {
    handleSendPromptToNewAgent,
    handleCreatePrompt,
    handleUpdatePrompt,
    handleDeletePrompt,
    handleMovePrompt,
    handleRevealWorkspacePrompts,
    handleRevealGeneralPrompts,
  } = useAppShellPromptActionsSection({
    activeWorkspace,
    alertError,
    connectWorkspace,
    createPrompt,
    deletePrompt,
    getGlobalPromptsDir,
    getWorkspacePromptsDir,
    movePrompt,
    sendUserMessageToThread,
    startThreadForWorkspace,
    updatePrompt,
  });

  const composer = {
    persistComposerSelectionForThread,
    resolveComposerSelectionForThread,
    collaborationModePayload,
    effectiveModels,
    effectiveReasoningOptions,
    effectiveReasoningSupported,
    effectiveSelectedEffort,
    effectiveSelectedModel,
    effectiveSelectedModelId,
    engineSelectedModelIdByType,
    handleSelectComposerEffort,
    handleSelectModel,
    providerModelCatalogs,
    resolvedEffort,
    resolvedModel,
    selectedAgent,
    selectedAgentRef,
    handleSelectAgent,
    reloadAgentCatalog,
    handleRefreshModelConfig,
    isModelConfigRefreshing,
    handleUserInputSubmitWithPlanApply,
    handleExitPlanModeExecute,
    activeImages,
    attachImages,
    pickImages,
    removeImage,
    clearActiveImages,
    removeImagesForThread,
    activeQueue,
    activeQueuedHandoffBubble,
    handleSend,
    queueMessage,
    prefillDraft,
    setPrefillDraft,
    composerInsert,
    setComposerInsert,
    getActiveDraft,
    handleDraftChange,
    handleSendPrompt,
    handleEditQueued,
    handleDeleteQueued,
    handleFuseQueued,
    canFuseActiveQueue,
    fuseDisabledReasonKey,
    activeFusingMessageId,
    clearDraftForThread,
    activeThreadIdRef,
    getThreadRows,
    handleCopyThread,
    renamePrompt,
    openRenamePrompt,
    handleRenamePromptChange,
    handleRenamePromptCancel,
    handleRenamePromptConfirm,
    deleteThreadPrompt,
    isDeleteThreadPromptBusy,
    openDeleteThreadPrompt,
    handleDeleteThreadPromptCancel,
    handleDeleteThreadPromptConfirm,
    handleRenameThread,
    handleSendPromptToNewAgent,
    handleCreatePrompt,
    handleUpdatePrompt,
    handleDeletePrompt,
    handleMovePrompt,
    handleRevealWorkspacePrompts,
    handleRevealGeneralPrompts,
  };
  usePublishHostSlice("composer", composer);
  return composer;
}
