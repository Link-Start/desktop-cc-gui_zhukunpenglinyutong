// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../features/collaboration/hooks/useCollaborationModeSelection", () => ({
  useCollaborationModeSelection: () => ({ collaborationModePayload: null }),
}));
vi.mock("../features/composer/hooks/useComposerMenuActions", () => ({
  useComposerMenuActions: () => {},
}));
vi.mock("../features/composer/hooks/useComposerShortcuts", () => ({
  useComposerShortcuts: () => {},
}));
vi.mock("../features/app/hooks/usePersistComposerSettings", () => ({
  usePersistComposerSettings: () => {},
}));

import { useAppShellComposerModelSection } from "./useAppShellComposerModelSection";

function makeModel(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    model: id,
    displayName: id,
    description: "",
    source: "test",
    supportedReasoningEfforts: [],
    defaultReasoningEffort: null,
    isDefault: false,
    ...overrides,
  };
}

const claudeModels = [
  makeModel("claude-opus-4-8", { isDefault: true }),
  makeModel("claude-sonnet-4-6"),
];
const kimiModels = [
  makeModel("kimi-code/k3", { isDefault: true }),
  makeModel("kimi-code/kimi-for-coding"),
];

function renderSection(overrides: Record<string, unknown> = {}) {
  return renderHook(() =>
    useAppShellComposerModelSection({
      accessMode: "auto",
      activeEngine: "claude",
      activeThreadId: null,
      activeWorkspaceId: null,
      appSettings: {},
      appSettingsLoading: false,
      applySelectedCollaborationMode: vi.fn(),
      collaborationModes: [],
      composerInputRef: { current: null },
      composerSelectionResolverRef: { current: null },
      engineModelCatalogsAsOptions: { kimi: kimiModels },
      engineModelsAsOptions: claudeModels,
      globalSelectionReady: true,
      handleSelectComposerSelection: vi.fn(),
      handleSetAccessMode: vi.fn(),
      models: [],
      modelsReady: true,
      persistComposerEnginePref: vi.fn(),
      persistComposerSelectionForThread: vi.fn(),
      queueSaveSettings: vi.fn(),
      selectedCollaborationMode: null,
      selectedCollaborationModeId: null,
      selectedComposerSelection: null,
      selectedEffort: null,
      selectedModelId: null,
      setAppSettings: vi.fn(),
      setSelectedEffort: vi.fn(),
      setSelectedModelId: vi.fn(),
      ...overrides,
    }),
  );
}

describe("useAppShellComposerModelSection handleSelectModel", () => {
  it("uses the bound Codex provider catalog instead of the global model list", () => {
    const providerModels = [
      makeModel("provider-a-model", { providerProfileId: "provider-a" }),
      makeModel("gpt-public"),
    ];
    const { result } = renderSection({
      activeEngine: "codex",
      activeThreadId: "codex-thread-1",
      activeProviderProfileId: "provider-a",
      engineModelsAsOptions: providerModels,
      models: [makeModel("global-default-model")],
    });

    expect(result.current.effectiveModels.map((model) => model.id)).toEqual([
      "provider-a-model",
      "gpt-public",
    ]);
    expect(
      result.current.effectiveModels.some(
        (model) => model.id === "global-default-model",
      ),
    ).toBe(false);
  });

  it("stores cross-engine picks under the owning engine and persists its pref", () => {
    const persistComposerEnginePref = vi.fn();
    const handleSelectComposerSelection = vi.fn();
    const setSelectedModelId = vi.fn();
    const { result } = renderSection({
      persistComposerEnginePref,
      handleSelectComposerSelection,
      setSelectedModelId,
    });

    act(() => {
      result.current.handleSelectModel("kimi-code/kimi-for-coding");
    });

    expect(result.current.engineSelectedModelIdByType.kimi).toBe(
      "kimi-code/kimi-for-coding",
    );
    expect(persistComposerEnginePref).toHaveBeenCalledWith("kimi", {
      modelId: "kimi-code/kimi-for-coding",
      effort: null,
    });
    expect(handleSelectComposerSelection).toHaveBeenCalledWith({
      modelId: "kimi-code/kimi-for-coding",
      effort: null,
    });
    expect(setSelectedModelId).not.toHaveBeenCalled();
  });

  it("keeps same-engine selection behavior unchanged", () => {
    const persistComposerEnginePref = vi.fn();
    const handleSelectComposerSelection = vi.fn();
    const { result } = renderSection({
      persistComposerEnginePref,
      handleSelectComposerSelection,
    });

    act(() => {
      result.current.handleSelectModel("claude-sonnet-4-6");
    });

    expect(result.current.engineSelectedModelIdByType.claude).toBe(
      "claude-sonnet-4-6",
    );
    expect(persistComposerEnginePref).toHaveBeenCalledWith("claude", {
      modelId: "claude-sonnet-4-6",
      effort: null,
    });
    expect(handleSelectComposerSelection).toHaveBeenCalledWith({
      modelId: "claude-sonnet-4-6",
      effort: null,
    });
  });

  it("ignores model ids that no engine catalog knows", () => {
    const persistComposerEnginePref = vi.fn();
    const handleSelectComposerSelection = vi.fn();
    const setSelectedModelId = vi.fn();
    const { result } = renderSection({
      persistComposerEnginePref,
      handleSelectComposerSelection,
      setSelectedModelId,
    });

    act(() => {
      result.current.handleSelectModel("no-such-model");
    });

    expect(persistComposerEnginePref).not.toHaveBeenCalled();
    expect(handleSelectComposerSelection).not.toHaveBeenCalled();
    expect(setSelectedModelId).not.toHaveBeenCalled();
  });
});
