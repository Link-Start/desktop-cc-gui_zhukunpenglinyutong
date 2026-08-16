/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { MessageSendOptions, WorkspaceInfo } from "../../types";
import { useAppShellComposerSendSection } from "./useAppShellComposerSendSection";

function createContext(overrides: Record<string, unknown> = {}) {
  const workspace: WorkspaceInfo = {
    id: "workspace-1",
    name: "Workspace",
    path: "/tmp/workspace",
    connected: true,
    settings: {
      sidebarCollapsed: false,
    },
  };
  return {
    activeWorkspace: workspace,
    workspaces: [workspace],
    setAppMode: vi.fn(),
    activeEngine: "claude",
    selectedAgent: null,
    selectedAgentRef: { current: null },
    activeWorkspaceId: workspace.id,
    normalizePath: (value: string) => value,
    addWorkspaceFromPath: vi.fn(),
    alertError: vi.fn(),
    workspacesById: new Map([[workspace.id, workspace]]),
    exitDiffView: vi.fn(),
    connectWorkspace: vi.fn(),
    startThreadForWorkspace: vi.fn().mockResolvedValue("thread-created"),
    persistComposerSelectionForThread: vi.fn(),
    setActiveEngine: vi.fn().mockResolvedValue(undefined),
    setHomeOpen: vi.fn(),
    setCenterMode: vi.fn(),
    selectWorkspace: vi.fn(),
    setActiveThreadId: vi.fn(),
    sendUserMessageToThread: vi.fn().mockResolvedValue(undefined),
    handleComposerSend: vi.fn(),
    isPullRequestComposer: false,
    resetPullRequestSelection: vi.fn(),
    setWorkspaceHomeWorkspaceId: vi.fn(),
    handleComposerQueue: vi.fn(),
    ...overrides,
  };
}

describe("useAppShellComposerSendSection Home target creation", () => {
  it("creates and sends with one selected Engine/Provider/Model target", async () => {
    const context = createContext();
    const { result } = renderHook(() =>
      useAppShellComposerSendSection(context as never),
    );
    const options: MessageSendOptions = {
      selectedMemoryIds: ["memory-1"],
      createSessionTarget: {
        engine: "codex",
        providerProfileId: "provider-b",
        providerProfileName: "Provider B",
        providerProfileSource: "managed",
        modelCatalogEntryId: "catalog-model",
        model: "runtime-model",
        effort: "high",
      },
    };

    await act(async () => {
      await result.current.handleComposerSendWithEditorFallback(
        "hello",
        [],
        options,
      );
    });

    expect(context.setActiveEngine).toHaveBeenCalledWith("codex");
    expect(context.startThreadForWorkspace).toHaveBeenCalledWith(
      "workspace-1",
      {
        engine: "codex",
        activate: true,
        providerProfileId: "provider-b",
        providerProfile: {
          id: "provider-b",
          name: "Provider B",
          source: "managed",
        },
      },
    );
    expect(context.persistComposerSelectionForThread).toHaveBeenCalledWith(
      "workspace-1",
      "thread-created",
      {
        modelId: "catalog-model",
        effort: "high",
      },
    );
    expect(context.sendUserMessageToThread).toHaveBeenCalledWith(
      context.activeWorkspace,
      "thread-created",
      "hello",
      [],
      expect.objectContaining({
        selectedMemoryIds: ["memory-1"],
        model: "runtime-model",
        effort: "high",
      }),
    );
    const forwardedOptions = vi.mocked(context.sendUserMessageToThread).mock
      .calls[0]?.[4] as MessageSendOptions;
    expect(forwardedOptions.createSessionTarget).toBeUndefined();
  });

  it("sends the DSH catalog id so host RPC can split provider/model", async () => {
    const context = createContext();
    const { result } = renderHook(() =>
      useAppShellComposerSendSection(context as never),
    );
    const options: MessageSendOptions = {
      createSessionTarget: {
        engine: "dsh",
        providerProfileId: null,
        providerProfileName: "本地配置",
        providerProfileSource: "disk",
        modelCatalogEntryId: "grok-4.6/Grok 4.5",
        model: "Grok 4.5",
        effort: null,
      },
    };

    await act(async () => {
      await result.current.handleComposerSendWithEditorFallback(
        "hello dsh",
        [],
        options,
      );
    });

    expect(context.setActiveEngine).toHaveBeenCalledWith("dsh");
    expect(context.startThreadForWorkspace).toHaveBeenCalledWith(
      "workspace-1",
      expect.objectContaining({
        engine: "dsh",
      }),
    );
    expect(context.sendUserMessageToThread).toHaveBeenCalledWith(
      context.activeWorkspace,
      "thread-created",
      "hello dsh",
      [],
      expect.objectContaining({
        model: "grok-4.6/Grok 4.5",
        effort: null,
      }),
    );
  });

  it("creates a local PI pending thread from the Home picker without a managed profile", async () => {
    const context = createContext();
    const { result } = renderHook(() =>
      useAppShellComposerSendSection(context as never),
    );
    const options: MessageSendOptions = {
      createSessionTarget: {
        engine: "pi",
        providerProfileId: null,
        providerProfileName: "本地配置",
        providerProfileSource: "disk",
        modelCatalogEntryId: "kimi-coding/k3",
        model: "kimi-coding/k3",
        effort: null,
      },
    };

    await act(async () => {
      await result.current.handleComposerSendWithEditorFallback(
        "hello pi",
        [],
        options,
      );
    });

    expect(context.setActiveEngine).toHaveBeenCalledWith("pi");
    expect(context.startThreadForWorkspace).toHaveBeenCalledWith(
      "workspace-1",
      {
        engine: "pi",
        activate: true,
        providerProfileId: null,
        providerProfile: null,
      },
    );
    expect(context.persistComposerSelectionForThread).toHaveBeenCalledWith(
      "workspace-1",
      "thread-created",
      {
        modelId: "kimi-coding/k3",
        effort: null,
      },
    );
    expect(context.sendUserMessageToThread).toHaveBeenCalledWith(
      context.activeWorkspace,
      "thread-created",
      "hello pi",
      [],
      expect.objectContaining({
        model: "kimi-coding/k3",
        effort: null,
      }),
    );
    const forwardedOptions = vi.mocked(context.sendUserMessageToThread).mock
      .calls[0]?.[4] as MessageSendOptions;
    expect(forwardedOptions.createSessionTarget).toBeUndefined();
  });
});
