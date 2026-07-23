// @vitest-environment jsdom
import { act, cleanup, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAppShellQuickSwitcherSection } from "./useAppShellQuickSwitcherSection";

vi.mock("../features/quick-switcher/hooks/useRecordRecentFilesFromActivity", () => ({
  useRecordRecentFilesFromActivity: vi.fn(),
}));

function createInput() {
  return {
    activeWorkspaceId: "workspace-a",
    threadsByWorkspace: {
      "workspace-a": [
        { id: "thread-old", name: "Old", updatedAt: 1 },
        { id: "thread-new", name: "New", updatedAt: 2 },
      ],
    },
    workspaces: [
      {
        id: "workspace-a",
        name: "Alpha",
        path: "/alpha",
        connected: true,
        settings: {},
      },
      {
        id: "workspace-b",
        name: "Beta",
        path: "/beta",
        connected: true,
        settings: {},
      },
    ] as any,
    activityTimeline: [],
    isCompact: false,
    isSearchPaletteOpen: false,
    setIsSearchPaletteOpen: vi.fn(),
    setActiveTab: vi.fn(),
    setActiveThreadId: vi.fn(),
    setAppMode: vi.fn(),
    setCenterMode: vi.fn(),
    setFilePanelMode: vi.fn(),
    setGitPanelMode: vi.fn(),
    setHomeOpen: vi.fn(),
    setWorkspaceHomeWorkspaceId: vi.fn(),
    selectWorkspace: vi.fn(),
    expandRightPanel: vi.fn(),
    handleOpenFile: vi.fn(),
    handleToggleTerminalPanel: vi.fn(),
    openSettings: vi.fn(),
  };
}

afterEach(cleanup);

describe("useAppShellQuickSwitcherSection", () => {
  it("opens with Ctrl+E on non-macOS and projects sessions newest first", () => {
    const input = createInput();
    const { result } = renderHook(() => useAppShellQuickSwitcherSection(input));

    fireEvent.keyDown(window, { key: "e", ctrlKey: true });

    expect(result.current.isQuickSwitcherOpen).toBe(true);
    expect(
      result.current.quickSwitcherSessionGroups.flatMap((group) =>
        group.sessions.map((session) => session.id),
      ),
    ).toEqual(["thread-new", "thread-old"]);
    expect(input.setIsSearchPaletteOpen).toHaveBeenCalledWith(false);
  });

  it("switches sessions without forcing the editor back to chat", () => {
    const input = createInput();
    const { result } = renderHook(() => useAppShellQuickSwitcherSection(input));

    act(() =>
      result.current.handleQuickSwitcherSelectSession(
        "workspace-a",
        "thread-new",
      ),
    );

    expect(input.setActiveThreadId).toHaveBeenCalledWith(
      "thread-new",
      "workspace-a",
    );
    expect(input.setCenterMode).not.toHaveBeenCalled();
    expect(input.setAppMode).toHaveBeenCalledWith("chat");
  });

  it("opens a file against its owning workspace and routes to the main codex area", () => {
    const input = createInput();
    const { result } = renderHook(() => useAppShellQuickSwitcherSection(input));

    act(() =>
      result.current.handleQuickSwitcherSelectFile(
        "workspace-b",
        "src/Beta.ts",
      ),
    );

    expect(input.setHomeOpen).toHaveBeenCalledWith(false);
    expect(input.setWorkspaceHomeWorkspaceId).toHaveBeenCalledWith(null);
    expect(input.setAppMode).toHaveBeenCalledWith("chat");
    expect(input.setActiveTab).toHaveBeenCalledWith("codex");
    expect(input.selectWorkspace).toHaveBeenCalledWith("workspace-b");
    expect(input.handleOpenFile).toHaveBeenCalledWith("src/Beta.ts", undefined, {
      targetWorkspace: input.workspaces[1],
    });
  });

  it("closes the home surface before opening the file from the bootstrap shell state", () => {
    const input = { ...createInput(), activeWorkspaceId: null };
    const { result } = renderHook(() => useAppShellQuickSwitcherSection(input));

    act(() =>
      result.current.handleQuickSwitcherSelectFile(
        "workspace-a",
        "src/Alpha.ts",
      ),
    );

    // All visibility prerequisites must settle before delegating to handleOpenFile,
    // otherwise the freshly-written file tab can remain behind the previous surface.
    const handleOpenOrder =
      input.handleOpenFile.mock.invocationCallOrder[0];
    expect(input.setHomeOpen).toHaveBeenCalledWith(false);
    expect(input.setWorkspaceHomeWorkspaceId).toHaveBeenCalledWith(null);
    expect(input.setHomeOpen.mock.invocationCallOrder[0]).toBeLessThan(
      handleOpenOrder,
    );
    expect(
      input.setWorkspaceHomeWorkspaceId.mock.invocationCallOrder[0],
    ).toBeLessThan(handleOpenOrder);
    expect(input.setAppMode.mock.invocationCallOrder[0]).toBeLessThan(
      handleOpenOrder,
    );
    expect(input.setActiveTab.mock.invocationCallOrder[0]).toBeLessThan(
      handleOpenOrder,
    );
    expect(input.selectWorkspace).toHaveBeenCalledWith("workspace-a");
    expect(input.handleOpenFile).toHaveBeenCalledWith("src/Alpha.ts", undefined, {
      targetWorkspace: input.workspaces[0],
    });
  });

  it("does not intercept Ctrl+E in compact layouts", () => {
    const input = { ...createInput(), isCompact: true };
    const { result } = renderHook(() => useAppShellQuickSwitcherSection(input));

    fireEvent.keyDown(window, { key: "e", ctrlKey: true });

    expect(result.current.isQuickSwitcherOpen).toBe(false);
  });
});
