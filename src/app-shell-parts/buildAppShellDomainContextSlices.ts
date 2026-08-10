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
  /** S4 bag-split PR-1：高 churn 会话投影 */
  sessionHot?: RuntimeThreadSessionHotFields;
}): AppShellDomainContextValue {
  return {
    ...input.legacyDefaults,
    ...input.runtimeActions,
    runtimeThreadBoundary: input.runtimeThreadBoundary,
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
