// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EngineType, WorkspaceInfo } from "../../../types";
import { useSidebarMenus } from "./useSidebarMenus";
import {
  createNativeProviderContinuation,
  getOpenCodeProviderHealth,
} from "../../../services/tauri";
import { pushGlobalRuntimeNotice } from "../../../services/globalRuntimeNotices";
import type {
  EngineDisplayInfo,
  EngineRefreshResult,
} from "../../engine/hooks/useEngineController";

const clientStoreMock = vi.hoisted(() => ({
  data: {} as Record<string, Record<string, unknown>>,
  getClientStoreSync: vi.fn((store: string, key: string) => {
    return clientStoreMock.data[store]?.[key];
  }),
  writeClientStoreValue: vi.fn((store: string, key: string, value: unknown) => {
    clientStoreMock.data[store] = {
      ...(clientStoreMock.data[store] ?? {}),
      [key]: value,
    };
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        "threads.rename": "Rename",
        "threads.autoName": "Auto name",
        "threads.autoNaming": "Auto naming",
        "threads.archive": "Archive",
        "threads.copyId": "Copy ID",
        "threads.copyClaudeResumeCommand": "Copy Claude resume command",
        "threads.openClaudeTui": "Open in Claude TUI",
        "threads.claudeResumeCommandHelp":
          "Use claude --resume <session_id> or /resume <session_id>.",
        "threads.moveToFolder": "Move to folder",
        "threads.moveToProjectRoot": "Project root",
        "threads.searchFolderTargets": "Search folders...",
        "threads.size": "Size",
        "threads.syncFromServer": "Sync from server",
        "threads.pin": "Pin",
        "threads.unpin": "Unpin",
        "threads.delete": "Delete",
        "sidebar.sessionActionsGroup": "New session",
        "sidebar.newSharedSession": "Shared Session",
        "sidebar.codexProviderChoiceTitle": "Provider selection",
        "sidebar.providerFollowsGlobalLabel": "Follows global config",
        "sidebar.providerIsolatedConfigLabel": "Isolated config",
        "sidebar.providerUnavailableLabel": "Provider unavailable",
        "sidebar.workspaceActionsGroup": "Workspace actions",
        "sidebar.activateWorkspace": "Open in main panel",
        "sidebar.setWorkspaceAlias": "Set alias",
        "sidebar.newSessionFolder": "New folder",
        "workspace.engineClaudeCode": "Claude Code",
        "workspace.engineCodex": "Codex",
        "workspace.engineOpenCode": "OpenCode",
        "workspace.engineGemini": "Gemini",
        "workspace.engineKimi": "Kimi CLI",
        "workspace.engineStatusLoading": "Checking...",
        "workspace.engineStatusRequiresLogin": "Sign in required",
        "threads.reloadThreads": "Reload threads",
        "sidebar.removeWorkspace": "Remove workspace",
        "sidebar.newWorktreeAgent": "New worktree agent",
        "sidebar.newCloneAgent": "New clone agent",
        "common.refresh": "Refresh",
        "sidebar.cliNotInstalled": "CLI not installed",
      };
      return dict[key] ?? key;
    },
  }),
}));

vi.mock("../../../services/tauri", () => ({
  createNativeProviderContinuation: vi.fn(),
  getOpenCodeProviderHealth: vi.fn(),
}));
vi.mock("../../../services/globalRuntimeNotices", () => ({
  pushGlobalRuntimeNotice: vi.fn(),
}));
vi.mock("../../../services/clientStorage", () => ({
  getClientStoreSync: clientStoreMock.getClientStoreSync,
  writeClientStoreValue: clientStoreMock.writeClientStoreValue,
}));

const getOpenCodeProviderHealthMock = vi.mocked(getOpenCodeProviderHealth);
const createNativeProviderContinuationMock = vi.mocked(
  createNativeProviderContinuation,
);
const pushGlobalRuntimeNoticeMock = vi.mocked(pushGlobalRuntimeNotice);

const workspace: WorkspaceInfo = {
  id: "ws-1",
  name: "mossx",
  path: "/tmp/mossx",
  connected: true,
  kind: "main",
  settings: {
    sidebarCollapsed: false,
    worktreeSetupScript: null,
  },
};

function createHandlers() {
  const engineOptions: EngineDisplayInfo[] = [
    {
      type: "claude",
      displayName: "Claude Code",
      shortName: "Claude Code",
      installed: true,
      version: "1.0.0",
      error: null,
      availabilityState: "ready",
      availabilityLabelKey: null,
    },
    {
      type: "codex",
      displayName: "Codex",
      shortName: "Codex",
      installed: true,
      version: "1.0.0",
      error: null,
      availabilityState: "ready",
      availabilityLabelKey: null,
    },
    {
      type: "opencode",
      displayName: "OpenCode",
      shortName: "OpenCode",
      installed: true,
      version: "1.4.4",
      error: null,
      availabilityState: "ready",
      availabilityLabelKey: null,
    },
    {
      type: "gemini",
      displayName: "Gemini",
      shortName: "Gemini",
      installed: true,
      version: "1.0.0",
      error: null,
      availabilityState: "ready",
      availabilityLabelKey: null,
    },
  ];

  return {
    onAddAgent: vi.fn(),
    engineOptions,
    enabledEngines: {
      gemini: true,
      opencode: true,
    } as Partial<Record<EngineType, boolean>>,
    onRefreshEngineOptions: vi.fn<
      () => Promise<EngineRefreshResult | void>
    >(async () => undefined),
    onAddSharedAgent: vi.fn(),
    onDeleteThread: vi.fn(),
    onArchiveThread: vi.fn(),
    onSyncThread: vi.fn(),
    onPinThread: vi.fn(),
    onUnpinThread: vi.fn(),
    isThreadPinned: vi.fn(() => false),
    isThreadAutoNaming: vi.fn(() => false),
    onRenameThread: vi.fn(),
    onAutoNameThread: vi.fn(),
    onMoveThreadToFolder: vi.fn(),
    onOpenThreadFolderPicker: vi.fn(),
    onOpenClaudeTui: vi.fn(),
    onReloadWorkspaceThreads: vi.fn(),
    onSelectThread: vi.fn(),
    onActivateWorkspace: vi.fn(),
    onCreateSessionFolder: vi.fn(),
    onToggleExitedSessions: vi.fn(),
    shouldShowExitedSessionsToggle: vi.fn(() => true),
    isExitedSessionsHidden: vi.fn(() => false),
    onDeleteWorkspace: vi.fn(),
    onDeleteWorktree: vi.fn(),
    onRenameWorkspaceAlias: vi.fn(),
    onAddWorktreeAgent: vi.fn(),
    onAddCloneAgent: vi.fn(),
  };
}

describe("useSidebarMenus", () => {
  beforeEach(() => {
    clientStoreMock.data = {};
    clientStoreMock.getClientStoreSync.mockClear();
    clientStoreMock.writeClientStoreValue.mockClear();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
    pushGlobalRuntimeNoticeMock.mockReset();
    createNativeProviderContinuationMock.mockReset();
    getOpenCodeProviderHealthMock.mockReset();
    getOpenCodeProviderHealthMock.mockResolvedValue({
      provider: "openai",
      connected: true,
      credentialCount: 1,
      matched: true,
      authenticatedProviders: ["openai"],
      error: null,
    });
  });

  it("shows loading hint when engine detection is still pending", () => {
    const handlers = createHandlers();
    handlers.engineOptions = handlers.engineOptions.map((engine) => ({
      ...engine,
      availabilityState: "loading",
      availabilityLabelKey: "workspace.engineStatusLoading",
      installed: false,
      version: null,
    }));
    const { result } = renderHook(() => useSidebarMenus(handlers));

    act(() => {
      const event = {
        clientX: 160,
        clientY: 120,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as Parameters<typeof result.current.showWorkspaceMenu>[0];
      result.current.showWorkspaceMenu(event, workspace);
    });

    const claudeAction = result.current.workspaceMenuState?.groups
      .find((group) => group.id === "new-session")
      ?.actions.find((action) => action.id === "new-session-claude");

    expect(claudeAction?.unavailable).toBe(true);
    expect(claudeAction?.statusLabel).toBe("Checking...");
  });

  it("rewrites session menu actions after engine availability finishes loading", async () => {
    const handlers = createHandlers();
    handlers.engineOptions = [];

    const { result, rerender } = renderHook(
      (nextHandlers: ReturnType<typeof createHandlers>) => useSidebarMenus(nextHandlers),
      { initialProps: handlers },
    );

    act(() => {
      const event = {
        clientX: 160,
        clientY: 120,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as Parameters<typeof result.current.showWorkspaceMenu>[0];
      result.current.showWorkspaceMenu(event, workspace);
    });

    const initialClaudeAction = result.current.workspaceMenuState?.groups
      .find((group) => group.id === "new-session")
      ?.actions.find((action) => action.id === "new-session-claude");

    expect(initialClaudeAction?.unavailable).toBe(true);

    await act(async () => {
      rerender(createHandlers());
    });

    const updatedClaudeAction = result.current.workspaceMenuState?.groups
      .find((group) => group.id === "new-session")
      ?.actions.find((action) => action.id === "new-session-claude");

    expect(updatedClaudeAction?.unavailable).toBe(false);
    expect(updatedClaudeAction?.statusLabel).toBeNull();
  });

  it("refreshes a single engine action without closing the menu", async () => {
    const handlers = createHandlers();
    handlers.engineOptions = [];
    let rerenderHook:
      | ((nextHandlers: ReturnType<typeof createHandlers>) => void)
      | null = null;
    handlers.onRefreshEngineOptions = vi.fn(async () => {
      rerenderHook?.(createHandlers());
    });

    const { result, rerender } = renderHook(
      (nextHandlers: ReturnType<typeof createHandlers>) => useSidebarMenus(nextHandlers),
      { initialProps: handlers },
    );
    rerenderHook = rerender;

    act(() => {
      const event = {
        clientX: 160,
        clientY: 120,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as Parameters<typeof result.current.showWorkspaceMenu>[0];
      result.current.showWorkspaceMenu(event, workspace);
    });

    const initialClaudeAction = result.current.workspaceMenuState?.groups
      .find((group) => group.id === "new-session")
      ?.actions.find((action) => action.id === "new-session-claude");

    expect(initialClaudeAction?.unavailable).toBe(true);
    expect(initialClaudeAction?.refreshable).toBe(true);

    await act(async () => {
      await initialClaudeAction?.onRefresh?.();
    });

    await waitFor(() => {
      const refreshedClaudeAction = result.current.workspaceMenuState?.groups
        .find((group) => group.id === "new-session")
        ?.actions.find((action) => action.id === "new-session-claude");

      expect(refreshedClaudeAction?.unavailable).toBe(false);
      expect(refreshedClaudeAction?.statusLabel).toBeNull();
    });

    expect(handlers.onRefreshEngineOptions).toHaveBeenCalledTimes(1);
    expect(pushGlobalRuntimeNoticeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messageKey: "runtimeNotice.engine.checking",
        messageParams: { engine: "Claude Code" },
      }),
    );
    expect(result.current.workspaceMenuState?.workspaceId).toBe(workspace.id);
  });

  it.each([
    ["claude", "Claude Code", "new-session-claude"],
    ["codex", "Codex", "new-session-codex"],
    ["kimi", "Kimi", "new-session-kimi"],
  ] as const)(
    "keeps %s refresh result visible before parent engine props rerender",
    async (engineType, expectedLabel, actionId) => {
      const handlers = createHandlers();
      handlers.engineOptions = [];
      handlers.onRefreshEngineOptions = vi.fn(async () => ({
        activeEngine: "claude",
        availableEngines: [
          {
            type: engineType as EngineType,
            displayName: expectedLabel,
            shortName: expectedLabel,
            installed: true,
            version: "1.0.0",
            error: null,
            availabilityState: "ready" as const,
            availabilityLabelKey: null,
          },
        ],
      }));

      const { result } = renderHook(() => useSidebarMenus(handlers));

      act(() => {
        const event = {
          clientX: 160,
          clientY: 120,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as unknown as Parameters<typeof result.current.showWorkspaceMenu>[0];
        result.current.showWorkspaceMenu(event, workspace);
      });

      const engineAction = result.current.workspaceMenuState?.groups
        .find((group) => group.id === "new-session")
        ?.actions.find((action) => action.id === actionId);

      expect(engineAction?.unavailable).toBe(true);

      await act(async () => {
        await engineAction?.onRefresh?.();
      });

      const refreshedAction = result.current.workspaceMenuState?.groups
        .find((group) => group.id === "new-session")
        ?.actions.find((action) => action.id === actionId);

      expect(refreshedAction?.unavailable).toBe(false);
      expect(refreshedAction?.statusLabel).toBeNull();
      expect(handlers.onRefreshEngineOptions).toHaveBeenCalledTimes(1);
    },
  );

  it("keeps retired OpenCode out of the session menu without probing health", async () => {
    const handlers = createHandlers();
    handlers.engineOptions = [];

    const { result, rerender } = renderHook(
      (nextHandlers: ReturnType<typeof createHandlers>) => useSidebarMenus(nextHandlers),
      { initialProps: handlers },
    );

    act(() => {
      const event = {
        clientX: 160,
        clientY: 120,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as Parameters<typeof result.current.showWorkspaceMenu>[0];
      result.current.showWorkspaceMenu(event, workspace);
    });

    rerender(createHandlers());

    const opencodeAction = result.current.workspaceMenuState?.groups
      .find((group) => group.id === "new-session")
      ?.actions.find((action) => action.id === "new-session-opencode");

    expect(opencodeAction).toBeUndefined();
    expect(getOpenCodeProviderHealthMock).not.toHaveBeenCalled();
  });

  it("hides Gemini even when legacy settings and engine status enable it", async () => {
    const handlers = createHandlers();
    const { result } = renderHook(() => useSidebarMenus(handlers));

    await act(async () => {
      const event = {
        clientX: 160,
        clientY: 120,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as Parameters<typeof result.current.showWorkspaceMenu>[0];
      result.current.showWorkspaceMenu(
        event,
        workspace,
      );
    });

    const groups = result.current.workspaceMenuState?.groups ?? [];
    const geminiAction = groups
      .find((group) => group.id === "new-session")
      ?.actions.find((action) => action.id === "new-session-gemini");

    expect(geminiAction).toBeUndefined();
  });

  it("hides Gemini and OpenCode session entries when they are disabled in settings", async () => {
    const handlers = createHandlers();
    handlers.enabledEngines = {
      gemini: false,
      opencode: false,
    };
    const { result } = renderHook(() => useSidebarMenus(handlers));

    await act(async () => {
      const event = {
        clientX: 160,
        clientY: 120,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as Parameters<typeof result.current.showWorkspaceMenu>[0];
      result.current.showWorkspaceMenu(event, workspace);
    });

    const sessionActions =
      result.current.workspaceMenuState?.groups.find((group) => group.id === "new-session")
        ?.actions ?? [];

    expect(sessionActions.map((action) => action.id)).not.toContain("new-session-gemini");
    expect(sessionActions.map((action) => action.id)).not.toContain("new-session-opencode");
  });

  it("moves workspace quick actions into the workspace actions menu group", async () => {
    const handlers = createHandlers();
    const { result } = renderHook(() => useSidebarMenus(handlers));

    await act(async () => {
      const event = {
        clientX: 160,
        clientY: 120,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as Parameters<typeof result.current.showWorkspaceMenu>[0];
      result.current.showWorkspaceMenu(event, workspace);
    });

    const workspaceActions =
      result.current.workspaceMenuState?.groups.find((group) => group.id === "workspace-actions")
        ?.actions ?? [];

    expect(workspaceActions.map((action) => action.id)).toEqual([
      "activate-workspace",
      "reload-threads",
      "toggle-exited-sessions",
      "create-session-folder",
      "rename-workspace-alias",
      "remove-workspace",
      "new-worktree-agent",
      "new-clone-agent",
    ]);

    act(() => {
      workspaceActions.find((action) => action.id === "activate-workspace")?.onSelect();
      workspaceActions.find((action) => action.id === "reload-threads")?.onSelect();
      workspaceActions.find((action) => action.id === "toggle-exited-sessions")?.onSelect();
      workspaceActions.find((action) => action.id === "create-session-folder")?.onSelect();
    });

    expect(handlers.onActivateWorkspace).toHaveBeenCalledWith("ws-1");
    expect(handlers.onReloadWorkspaceThreads).toHaveBeenCalledWith("ws-1");
    expect(handlers.onToggleExitedSessions).toHaveBeenCalledWith("/tmp/mossx");
    expect(handlers.onCreateSessionFolder).toHaveBeenCalledWith("ws-1");
  });

  it("marks only the original row actions as pinnable and toggles the shared preference", async () => {
    clientStoreMock.data = {
      app: {
        sidebarWorkspacePinnedActions: ["reload-threads"],
      },
    };
    const handlers = createHandlers();
    const { result } = renderHook(() => useSidebarMenus(handlers));

    await act(async () => {
      const event = {
        clientX: 160,
        clientY: 120,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as Parameters<typeof result.current.showWorkspaceMenu>[0];
      result.current.showWorkspaceMenu(event, workspace);
    });

    const workspaceActions =
      result.current.workspaceMenuState?.groups.find((group) => group.id === "workspace-actions")
        ?.actions ?? [];
    const reloadAction = workspaceActions.find((action) => action.id === "reload-threads");
    const activateAction = workspaceActions.find((action) => action.id === "activate-workspace");
    const renameAction = workspaceActions.find((action) => action.id === "rename-workspace-alias");

    // Only the four buttons that used to live inline on the workspace row are pinnable.
    expect(
      workspaceActions.filter((action) => action.pinnable).map((action) => action.id),
    ).toEqual([
      "activate-workspace",
      "reload-threads",
      "toggle-exited-sessions",
      "create-session-folder",
    ]);
    expect(renameAction?.pinnable).toBeFalsy();
    expect(reloadAction?.pinned).toBe(true);
    expect(activateAction?.pinned).toBe(false);

    act(() => {
      activateAction?.onTogglePinned?.();
    });

    expect(clientStoreMock.writeClientStoreValue).toHaveBeenCalledWith(
      "app",
      "sidebarWorkspacePinnedActions",
      ["reload-threads", "activate-workspace"],
    );
  });

  it("labels Codex provider choices by config source", async () => {
    const handlers = createHandlers();
    const { result } = renderHook(() =>
      useSidebarMenus({
        ...handlers,
        codexProviderProfiles: [
          {
            id: "provider-openai",
            name: "OpenAI",
            source: "managed",
          },
        ],
      }),
    );

    await act(async () => {
      const event = {
        clientX: 160,
        clientY: 120,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as Parameters<typeof result.current.showWorkspaceMenu>[0];
      result.current.showWorkspaceMenu(event, workspace);
    });

    const codexAction = result.current.workspaceMenuState?.groups
      .find((group) => group.id === "new-session")
      ?.actions.find((action) => action.id === "new-session-codex");

    expect(codexAction?.submenuTitle).toBe("Provider selection");
    expect(
      codexAction?.children?.map((child) => ({
        id: child.id,
        badgeLabel: child.badgeLabel,
      })),
    ).toEqual([
      {
        id: "new-session-codex-provider-__disk__",
        badgeLabel: "Follows global config",
      },
      {
        id: "new-session-codex-provider-provider-openai",
        badgeLabel: "Isolated config",
      },
    ]);
  });

  it("remembers the last picked Codex provider for direct main-entry creation", async () => {
    window.localStorage.removeItem("codexLastProviderProfileId");
    const handlers = createHandlers();
    const { result } = renderHook(() =>
      useSidebarMenus({
        ...handlers,
        codexProviderProfiles: [
          {
            id: "provider-openai",
            name: "OpenAI",
            source: "managed",
          },
        ],
      }),
    );

    const openMenuAndGetCodexAction = async () => {
      await act(async () => {
        const event = {
          clientX: 160,
          clientY: 120,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as unknown as Parameters<typeof result.current.showWorkspaceMenu>[0];
        result.current.showWorkspaceMenu(event, workspace);
      });
      return result.current.workspaceMenuState?.groups
        .find((group) => group.id === "new-session")
        ?.actions.find((action) => action.id === "new-session-codex");
    };

    // No memory yet: main entry falls back to the disk profile.
    const codexAction = await openMenuAndGetCodexAction();
    expect(
      codexAction?.children?.find((child) => child.selected)?.id,
    ).toBe("new-session-codex-provider-__disk__");
    await act(async () => {
      await codexAction?.onSelect();
    });
    expect(handlers.onAddAgent).toHaveBeenLastCalledWith(
      workspace,
      "codex",
      expect.objectContaining({ providerProfileId: "__disk__" }),
    );

    // Picking a submenu provider only selects it (no session created).
    handlers.onAddAgent.mockClear();
    await act(async () => {
      await codexAction?.children
        ?.find((child) => child.id === "new-session-codex-provider-provider-openai")
        ?.onSelect();
    });
    expect(handlers.onAddAgent).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("codexLastProviderProfileId")).toBe(
      "provider-openai",
    );
    expect(pushGlobalRuntimeNoticeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messageKey: "runtimeNotice.codex.providerSelected",
        messageParams: { name: "OpenAI" },
      }),
    );

    // The rebuilt menu shows the check on the picked provider and the
    // main entry now creates with it directly.
    const reopenedAction = await openMenuAndGetCodexAction();
    expect(
      reopenedAction?.children?.find((child) => child.selected)?.id,
    ).toBe("new-session-codex-provider-provider-openai");
    await act(async () => {
      await reopenedAction?.onSelect();
    });
    expect(handlers.onAddAgent).toHaveBeenLastCalledWith(
      workspace,
      "codex",
      expect.objectContaining({ providerProfileId: "provider-openai" }),
    );
  });

  it.each([
    {
      engine: "claude" as const,
      localId: "__local_settings_json__",
      storageKey: "claudeLastProviderProfileId",
    },
    {
      engine: "kimi" as const,
      localId: "__local_config_toml__",
      storageKey: "kimiLastProviderProfileId",
    },
  ])(
    "selects and remembers $engine provider without creating from the submenu",
    async ({ engine, localId, storageKey }) => {
      window.localStorage.removeItem(storageKey);
      const handlers = createHandlers();
      const profileProp =
        engine === "claude"
          ? {
              claudeProviderProfiles: [
                { id: localId, name: "Local", source: "managed" as const },
                { id: "provider-a", name: "Provider A", source: "managed" as const },
              ],
            }
          : {
              kimiProviderProfiles: [
                { id: localId, name: "Local", source: "managed" as const },
                { id: "provider-a", name: "Provider A", source: "managed" as const },
              ],
            };
      const { result } = renderHook(() =>
        useSidebarMenus({ ...handlers, ...profileProp }),
      );
      const openMenu = async () => {
        await act(async () => {
          result.current.showWorkspaceMenu(
            {
              clientX: 160,
              clientY: 120,
              preventDefault: vi.fn(),
              stopPropagation: vi.fn(),
            } as unknown as Parameters<typeof result.current.showWorkspaceMenu>[0],
            workspace,
          );
        });
        return result.current.workspaceMenuState?.groups
          .find((group) => group.id === "new-session")
          ?.actions.find((action) => action.id === `new-session-${engine}`);
      };

      const action = await openMenu();
      expect(action?.children).toHaveLength(2);
      expect(action?.children?.find((child) => child.selected)?.id).toBe(
        `new-session-${engine}-provider-${localId}`,
      );
      await act(async () => {
        await action?.children
          ?.find((child) => child.id === `new-session-${engine}-provider-provider-a`)
          ?.onSelect();
      });
      expect(handlers.onAddAgent).not.toHaveBeenCalled();
      expect(window.localStorage.getItem(storageKey)).toBe("provider-a");

      const reopened = await openMenu();
      await act(async () => {
        await reopened?.onSelect();
      });
      expect(handlers.onAddAgent).toHaveBeenCalledWith(
        workspace,
        engine,
        expect.objectContaining({ providerProfileId: "provider-a" }),
      );
    },
  );

  it("keeps a missing remembered managed provider unavailable instead of falling back local", async () => {
    window.localStorage.setItem("kimiLastProviderProfileId", "provider-missing");
    const handlers = createHandlers();
    const { result } = renderHook(() =>
      useSidebarMenus({ ...handlers, kimiProviderProfiles: [] }),
    );

    await act(async () => {
      result.current.showWorkspaceMenu(
        {
          clientX: 160,
          clientY: 120,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as unknown as Parameters<typeof result.current.showWorkspaceMenu>[0],
        workspace,
      );
    });

    const action = result.current.workspaceMenuState?.groups
      .find((group) => group.id === "new-session")
      ?.actions.find((entry) => entry.id === "new-session-kimi");
    const selected = action?.children?.find((child) => child.selected);

    expect(action?.unavailable).toBe(true);
    expect(selected).toMatchObject({
      id: "new-session-kimi-provider-provider-missing",
      unavailable: true,
      badgeLabel: "Provider unavailable",
    });
    await act(async () => {
      await action?.onSelect();
    });
    expect(handlers.onAddAgent).not.toHaveBeenCalled();
  });

  it("cannot trigger session creation through a hidden Gemini entry", async () => {
    const handlers = createHandlers();
    const { result } = renderHook(() => useSidebarMenus(handlers));

    await act(async () => {
      const event = {
        clientX: 200,
        clientY: 200,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as Parameters<typeof result.current.showWorkspaceMenu>[0];
      result.current.showWorkspaceMenu(
        event,
        workspace,
      );
    });

    const geminiAction = result.current.workspaceMenuState?.groups
      .find((group) => group.id === "new-session")
      ?.actions.find((action) => action.id === "new-session-gemini");

    expect(geminiAction).toBeUndefined();
    expect(handlers.onAddAgent).not.toHaveBeenCalled();
  });

  it("places archive before size and delete in the thread context menu", async () => {
    const handlers = createHandlers();
    const { result } = renderHook(() => useSidebarMenus(handlers));

    await act(async () => {
      const event = {
        clientX: 240,
        clientY: 180,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as Parameters<typeof result.current.showThreadMenu>[0];
      await result.current.showThreadMenu(
        event,
        "ws-1",
        "thread-1",
        true,
        1536,
      );
    });

    const items = result.current.sidebarContextMenuState?.items ?? [];
    expect(items.map((item) => item.type === "separator" ? "---" : item.label)).toEqual([
      "Rename",
      "Auto name",
      "Sync from server",
      "Pin",
      "Copy ID",
      "Archive",
      "Size: 1.5 KB",
      "Delete",
    ]);
    expect(items[6]?.type).toBe("label");
  });

  it("creates a top-level provider continuation from a native thread", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    createNativeProviderContinuationMock
      .mockResolvedValueOnce({
        status: "confirmation-required",
        fidelity: "degraded",
        projectionMode: "checkpoint",
        sourceEstimatedTokens: 1200,
        packageEstimatedTokens: 600,
        omissions: [{ category: "image", reason: "unsupported" }],
        adapterDroppedEntries: 1,
        operation: { phase: "prepared" },
      })
      .mockResolvedValueOnce({
        status: "ready",
        fidelity: "degraded",
        operation: {
          phase: "ready",
          resultSessionId: "codex:target-1",
        },
      });
    const handlers = {
      ...createHandlers(),
      codexProviderProfiles: [
        {
          id: "provider-b",
          name: "Provider B",
          source: "managed" as const,
          availability: "available" as const,
        },
      ],
      getThreadSummary: () => ({
        id: "claude:source-1",
        name: "Source",
        updatedAt: 1,
        threadKind: "native" as const,
        engineSource: "claude" as const,
        providerProfileId: "provider-a",
      }),
    };
    const { result } = renderHook(() => useSidebarMenus(handlers));

    act(() => {
      result.current.showThreadMenu(
        {
          clientX: 1,
          clientY: 1,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as unknown as Parameters<typeof result.current.showThreadMenu>[0],
        "ws-1",
        "claude:source-1",
        true,
      );
    });
    const submenu = result.current.sidebarContextMenuState?.items.find(
      (item) => item.type === "submenu" && item.id === "continue-with-provider",
    );
    expect(submenu?.type).toBe("submenu");
    await act(async () => {
      if (submenu?.type === "submenu" && submenu.items[0]?.type === "item") {
        await submenu.items[0].onSelect();
      }
    });

    expect(createNativeProviderContinuationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        source: expect.objectContaining({
          sessionId: "claude:source-1",
          nativeSessionId: "source-1",
          providerProfileId: "provider-a",
        }),
        destination: expect.objectContaining({
          engine: "codex",
          providerProfileId: "provider-b",
        }),
      }),
    );
    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining(
        "Mode: checkpoint\nEstimated tokens: 1200 → 600\nOmissions:\n- image: unsupported",
      ),
    );
    expect(createNativeProviderContinuationMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ confirmDegraded: true }),
    );
    expect(handlers.onReloadWorkspaceThreads).toHaveBeenCalledWith("ws-1");
    expect(handlers.onSelectThread).toHaveBeenCalledWith(
      "ws-1",
      "codex:target-1",
    );
    confirm.mockRestore();
  });

  it("can continue a Codex thread back to a Claude provider", async () => {
    createNativeProviderContinuationMock.mockResolvedValue({
      status: "ready",
      fidelity: "strong",
      operation: {
        phase: "ready",
        resultSessionId: "claude:target-2",
      },
    });
    const handlers = {
      ...createHandlers(),
      claudeProviderProfiles: [
        {
          id: "provider-a",
          name: "Provider A",
          source: "managed" as const,
          availability: "available" as const,
        },
      ],
      getThreadSummary: () => ({
        id: "codex:source-2",
        name: "Source",
        updatedAt: 1,
        threadKind: "native" as const,
        engineSource: "codex" as const,
        providerProfileId: "provider-b",
      }),
    };
    const { result } = renderHook(() => useSidebarMenus(handlers));

    act(() => {
      result.current.showThreadMenu(
        {
          clientX: 1,
          clientY: 1,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as unknown as Parameters<typeof result.current.showThreadMenu>[0],
        "ws-1",
        "codex:source-2",
        true,
      );
    });
    const submenu = result.current.sidebarContextMenuState?.items.find(
      (item) => item.type === "submenu" && item.id === "continue-with-provider",
    );
    await act(async () => {
      if (submenu?.type === "submenu" && submenu.items[0]?.type === "item") {
        await submenu.items[0].onSelect();
      }
    });

    expect(createNativeProviderContinuationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: expect.objectContaining({
          sessionId: "codex:source-2",
          providerProfileId: "provider-b",
        }),
        destination: expect.objectContaining({
          engine: "claude",
          providerProfileId: "provider-a",
          runtimeCapabilityFingerprint: "echo-checksum",
        }),
      }),
    );
    expect(handlers.onSelectThread).toHaveBeenCalledWith(
      "ws-1",
      "claude:target-2",
    );
  });

  it("archives a thread from the thread context menu", async () => {
    const handlers = createHandlers();
    const { result } = renderHook(() => useSidebarMenus(handlers));

    await act(async () => {
      const event = {
        clientX: 240,
        clientY: 180,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as Parameters<typeof result.current.showThreadMenu>[0];
      await result.current.showThreadMenu(
        event,
        "ws-1",
        "claude:thread-1",
        true,
        undefined,
        [],
        null,
        true,
        "/tmp/mossx",
      );
    });

    const items = result.current.sidebarContextMenuState?.items ?? [];
    expect(items.map((item) => item.type === "separator" ? "---" : item.label)).toEqual([
      "Rename",
      "Auto name",
      "Pin",
      "Copy ID",
      "Open in Claude TUI",
      "Copy Claude resume command",
      "Use claude --resume <session_id> or /resume <session_id>.",
      "Archive",
      "Delete",
    ]);

    await act(async () => {
      if (items[7]?.type === "item") {
        await items[7].onSelect();
      }
    });

    expect(handlers.onArchiveThread).toHaveBeenCalledWith(
      "ws-1",
      "claude:thread-1",
    );
  });

  it("copies Claude resume commands and keeps Copy ID bare", async () => {
    const handlers = createHandlers();
    const { result } = renderHook(() => useSidebarMenus(handlers));

    await act(async () => {
      const event = {
        clientX: 240,
        clientY: 180,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as Parameters<typeof result.current.showThreadMenu>[0];
      await result.current.showThreadMenu(
        event,
        "ws-1",
        "claude:session-1",
        true,
        undefined,
        [],
        null,
        true,
        "/tmp/My Project",
      );
    });

    const items = result.current.sidebarContextMenuState?.items ?? [];
    const copyIdAction = items.find((item) => item.type === "item" && item.id === "copy-id");
    const copyResumeAction = items.find(
      (item) => item.type === "item" && item.id === "copy-claude-resume-command",
    );

    await act(async () => {
      if (copyIdAction?.type === "item") {
        await copyIdAction.onSelect();
      }
    });
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith("session-1");

    await act(async () => {
      if (copyResumeAction?.type === "item") {
        await copyResumeAction.onSelect();
      }
    });
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(
      "cd '/tmp/My Project' && claude --resume 'session-1'",
    );
    expect(pushGlobalRuntimeNoticeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messageKey: "runtimeNotice.claude.resumeCommandCopied",
        messageParams: { sessionId: "session-1" },
      }),
    );
  });

  it("opens finalized Claude threads in Claude TUI with workspace and native session id", async () => {
    const handlers = createHandlers();
    const { result } = renderHook(() => useSidebarMenus(handlers));

    await act(async () => {
      const event = {
        clientX: 240,
        clientY: 180,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as Parameters<typeof result.current.showThreadMenu>[0];
      await result.current.showThreadMenu(
        event,
        "ws-1",
        "claude:session-1",
        true,
        undefined,
        [],
        null,
        true,
        "/tmp/mossx",
      );
    });

    const openAction = result.current.sidebarContextMenuState?.items.find(
      (item) => item.type === "item" && item.id === "open-claude-tui",
    );
    await act(async () => {
      if (openAction?.type === "item") {
        await openAction.onSelect();
      }
    });

    expect(handlers.onOpenClaudeTui).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      workspacePath: "/tmp/mossx",
      sessionId: "session-1",
    });
  });

  it("suppresses Claude TUI resume actions for pending and non-Claude thread ids", async () => {
    const handlers = createHandlers();
    const { result } = renderHook(() => useSidebarMenus(handlers));

    for (const threadId of ["claude-pending-1", "codex:thread-1"]) {
      await act(async () => {
        const event = {
          clientX: 240,
          clientY: 180,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as unknown as Parameters<typeof result.current.showThreadMenu>[0];
        await result.current.showThreadMenu(
          event,
          "ws-1",
          threadId,
          true,
          undefined,
          [],
          null,
          true,
          "/tmp/mossx",
        );
      });

      const itemIds = (result.current.sidebarContextMenuState?.items ?? [])
        .filter((item) => item.type === "item")
        .map((item) => item.id);
      expect(itemIds).not.toContain("open-claude-tui");
      expect(itemIds).not.toContain("copy-claude-resume-command");
    }
  });

  it("hides archive for unsupported thread context menu targets", async () => {
    const handlers = createHandlers();
    const { result } = renderHook(() => useSidebarMenus(handlers));

    await act(async () => {
      const event = {
        clientX: 240,
        clientY: 180,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as Parameters<typeof result.current.showThreadMenu>[0];
      await result.current.showThreadMenu(
        event,
        "ws-1",
        "shared:thread-1",
        true,
        undefined,
        [],
        null,
        false,
      );
    });

    const items = result.current.sidebarContextMenuState?.items ?? [];
    expect(items.map((item) => item.type === "separator" ? "---" : item.label)).toEqual([
      "Rename",
      "Auto name",
      "Sync from server",
      "Pin",
      "Copy ID",
      "Delete",
    ]);
  });

  it("adds same-project folder move targets to the thread context menu", async () => {
    const handlers = createHandlers();
    const { result } = renderHook(() => useSidebarMenus(handlers));

    await act(async () => {
      const event = {
        clientX: 240,
        clientY: 180,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as Parameters<typeof result.current.showThreadMenu>[0];
      await result.current.showThreadMenu(
        event,
        "ws-1",
        "thread-1",
        true,
        undefined,
        [
          { folderId: null, label: "Project root" },
          { folderId: "folder-a", label: "Planning" },
        ],
        "folder-a",
      );
    });

    const items = result.current.sidebarContextMenuState?.items ?? [];
    expect(items.map((item) => item.type === "separator" ? "---" : item.label)).toEqual([
      "Rename",
      "Auto name",
      "Sync from server",
      "Pin",
      "Copy ID",
      "Archive",
      "Move to folder",
      "Delete",
    ]);
    const moveItem = items.find((item) => item.type === "submenu" && item.id === "move-to-folder");
    expect(moveItem?.type).toBe("submenu");
    expect(
      moveItem?.type === "submenu"
        ? moveItem.items.map((item) => item.type === "separator" ? "---" : item.label)
        : [],
    ).toEqual(["Project root", "Planning"]);
    expect(
      moveItem?.type === "submenu" && moveItem.items[1]?.type === "item"
        ? moveItem.items[1].disabled
        : false,
    ).toBe(true);

    await act(async () => {
      if (moveItem?.type === "submenu" && moveItem.items[0]?.type === "item") {
        await moveItem.items[0].onSelect();
      }
    });

    expect(handlers.onMoveThreadToFolder).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      null,
    );
  });

  it("keeps folder move targets visible when large lists also offer search", async () => {
    const handlers = createHandlers();
    const targets = [
      { folderId: null, label: "Project root" },
      ...Array.from({ length: 13 }, (_, index) => ({
        folderId: `folder-${index + 1}`,
        label: `Folder ${index + 1}`,
      })),
    ];
    const { result } = renderHook(() => useSidebarMenus(handlers));

    await act(async () => {
      const event = {
        clientX: 240,
        clientY: 180,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as Parameters<typeof result.current.showThreadMenu>[0];
      await result.current.showThreadMenu(
        event,
        "ws-1",
        "thread-1",
        true,
        undefined,
        targets,
        "folder-7",
      );
    });

    const items = result.current.sidebarContextMenuState?.items ?? [];
    expect(items.map((item) => item.type === "separator" ? "---" : item.label)).toEqual([
      "Rename",
      "Auto name",
      "Sync from server",
      "Pin",
      "Copy ID",
      "Archive",
      "Move to folder",
      "Delete",
    ]);
    const moveItem = items.find((item) => item.type === "submenu" && item.id === "move-to-folder");
    expect(moveItem?.type).toBe("submenu");
    expect(
      moveItem?.type === "submenu"
        ? moveItem.items.map((item) => item.type === "separator" ? "---" : item.label)
        : [],
    ).toEqual([
      "Search folders...",
      "Project root",
      "Folder 1",
      "Folder 2",
      "Folder 3",
      "Folder 4",
      "Folder 5",
      "Folder 6",
      "Folder 7",
      "Folder 8",
      "Folder 9",
      "Folder 10",
      "Folder 11",
      "Folder 12",
      "Folder 13",
    ]);
    expect(
      moveItem?.type === "submenu" && moveItem.items[8]?.type === "item"
        ? moveItem.items[8].disabled
        : false,
    ).toBe(true);

    await act(async () => {
      if (moveItem?.type === "submenu" && moveItem.items[0]?.type === "item") {
        await moveItem.items[0].onSelect();
      }
    });

    expect(handlers.onOpenThreadFolderPicker).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      targets,
      "folder-7",
    );
    expect(handlers.onMoveThreadToFolder).not.toHaveBeenCalled();

    await act(async () => {
      if (moveItem?.type === "submenu" && moveItem.items[2]?.type === "item") {
        await moveItem.items[2].onSelect();
      }
    });

    expect(handlers.onMoveThreadToFolder).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "folder-1",
    );
  });

  it("triggers create action when Shared Session entry is clicked", async () => {
    const handlers = createHandlers();
    const { result } = renderHook(() => useSidebarMenus(handlers));

    await act(async () => {
      const event = {
        clientX: 180,
        clientY: 180,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as Parameters<typeof result.current.showWorkspaceMenu>[0];
      result.current.showWorkspaceMenu(event, workspace);
    });

    const sharedAction = result.current.workspaceMenuState?.groups
      .find((group) => group.id === "new-session")
      ?.actions.find((action) => action.id === "new-session-shared");

    expect(sharedAction).toBeTruthy();
    act(() => {
      result.current.onWorkspaceMenuAction(sharedAction!);
    });

    expect(handlers.onAddSharedAgent).toHaveBeenCalledTimes(1);
    expect(handlers.onAddSharedAgent).toHaveBeenCalledWith(workspace);
  });

  it("triggers workspace alias action from the workspace menu", async () => {
    const handlers = createHandlers();
    const { result } = renderHook(() => useSidebarMenus(handlers));

    await act(async () => {
      const event = {
        clientX: 180,
        clientY: 180,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as Parameters<typeof result.current.showWorkspaceMenu>[0];
      result.current.showWorkspaceMenu(event, workspace);
    });

    const aliasAction = result.current.workspaceMenuState?.groups
      .find((group) => group.id === "workspace-actions")
      ?.actions.find((action) => action.id === "rename-workspace-alias");

    expect(aliasAction?.label).toBe("Set alias");
    act(() => {
      result.current.onWorkspaceMenuAction(aliasAction!);
    });

    expect(handlers.onRenameWorkspaceAlias).toHaveBeenCalledTimes(1);
    expect(handlers.onRenameWorkspaceAlias).toHaveBeenCalledWith(workspace);
  });

  it("shows session-only menu for worktree plus entry", async () => {
    const handlers = createHandlers();
    const { result } = renderHook(() => useSidebarMenus(handlers));

    await act(async () => {
      const event = {
        clientX: 140,
        clientY: 96,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as Parameters<typeof result.current.showWorkspaceSessionMenu>[0];
      result.current.showWorkspaceSessionMenu(event, workspace);
    });

    expect(result.current.workspaceMenuState?.groups.map((group) => group.id)).toEqual([
      "new-session",
    ]);
    expect(
      result.current.workspaceMenuState?.groups[0]?.actions.map((action) => action.id),
    ).toEqual([
      "new-session-shared",
      "new-session-claude",
      "new-session-codex",
      "new-session-kimi",
    ]);
  });
});
