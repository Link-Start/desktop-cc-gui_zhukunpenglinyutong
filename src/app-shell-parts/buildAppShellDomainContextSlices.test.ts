import { describe, expect, it } from "vitest";
import {
  buildCollaborationModeDomainContextSlice,
  buildModelSelectionDomainContextSlice,
  buildRuntimeDomainContextSlice,
  buildRuntimeThreadDomainContextSlice,
} from "./buildAppShellDomainContextSlices";

describe("buildAppShellDomainContextSlices", () => {
  it("builds runtimeThread slice with boundary, actions, and session hot fields", () => {
    const slice = buildRuntimeThreadDomainContextSlice({
      legacyDefaults: { legacy: true },
      runtimeActions: { handleToggleTerminalPanel: () => {} },
      runtimeThreadBoundary: { activeThreadId: "t1" },
      sessionHot: {
        activeItems: [],
        activePlan: null,
        activeRateLimits: null,
        activeTokenUsage: null,
        activeTurnId: "turn-1",
        canInterrupt: true,
        isProcessing: true,
        isReviewing: false,
        timelinePlan: null,
      },
    });
    expect(slice.legacy).toBe(true);
    expect(slice.runtimeThreadBoundary).toEqual({ activeThreadId: "t1" });
    expect(typeof slice.handleToggleTerminalPanel).toBe("function");
    expect(slice.isProcessing).toBe(true);
    expect(slice.canInterrupt).toBe(true);
    expect(slice.activeTurnId).toBe("turn-1");
  });

  it("builds model selection slice with only model keys", () => {
    const slice = buildModelSelectionDomainContextSlice({
      effectiveModels: [],
      effectiveReasoningSupported: true,
      effectiveSelectedModel: null,
      effectiveSelectedModelId: "m1",
      providerModelCatalogs: {},
      reasoningOptions: [],
      reasoningSupported: true,
      refreshEngineModels: () => {},
      resolvedEffort: null,
      resolvedModel: null,
      selectedEffort: null,
      selectedModelId: "m1",
      setSelectedEffort: () => {},
      setSelectedModelId: () => {},
    });
    expect(Object.keys(slice).sort()).toEqual(
      [
        "effectiveModels",
        "effectiveReasoningSupported",
        "effectiveSelectedModel",
        "effectiveSelectedModelId",
        "providerModelCatalogs",
        "reasoningOptions",
        "reasoningSupported",
        "refreshEngineModels",
        "resolvedEffort",
        "resolvedModel",
        "selectedEffort",
        "selectedModelId",
        "setSelectedEffort",
        "setSelectedModelId",
      ].sort(),
    );
  });

  it("builds collaboration and runtime slices", () => {
    const collab = buildCollaborationModeDomainContextSlice({
      applySelectedCollaborationMode: () => {},
      collaborationModePayload: null,
      collaborationModes: [],
      collaborationModesEnabled: true,
      collaborationRuntimeModeByThread: {},
      collaborationUiModeByThread: {},
      handleCollaborationModeResolved: () => {},
      resolveCollaborationRuntimeMode: () => null,
      resolveCollaborationUiMode: () => null,
      selectedCollaborationMode: null,
      selectedCollaborationModeId: null,
      setCodexCollaborationMode: () => {},
      setCollaborationRuntimeModeByThread: () => {},
      setCollaborationUiModeByThread: () => {},
      setSelectedCollaborationModeId: () => {},
    });
    expect(collab.collaborationModesEnabled).toBe(true);

    const runtime = buildRuntimeDomainContextSlice({
      runtimeRunState: { phase: "idle" },
    });
    expect(runtime).toEqual({ runtimeRunState: { phase: "idle" } });
  });
});
