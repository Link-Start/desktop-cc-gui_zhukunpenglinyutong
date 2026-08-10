import type { AppShellDomainContextValue } from "./appShellDomainContexts";

/**
 * S4 PR-F：按域构造 context slice，避免在 AppShell 里继续「字母序切 bag」。
 * flatten 仍兼容 legacy 全量读侧；但 model / collab / runtimeThread 等干净域
 * 必须经这些 builder 进入 defineAppShellDomainContexts。
 */

export function buildRuntimeThreadDomainContextSlice(input: {
  legacyDefaults: AppShellDomainContextValue;
  runtimeActions: AppShellDomainContextValue;
  runtimeThreadBoundary: unknown;
}): AppShellDomainContextValue {
  return {
    ...input.legacyDefaults,
    ...input.runtimeActions,
    runtimeThreadBoundary: input.runtimeThreadBoundary,
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
