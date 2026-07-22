import { useCallback, useEffect, useMemo, useState } from "react";
import { useGlobalSearchShortcut } from "../features/app/hooks/useGlobalSearchShortcut";
import type { CenterMode } from "../features/app/hooks/useGitPanelController";
import { useRecordRecentFilesFromActivity } from "../features/quick-switcher/hooks/useRecordRecentFilesFromActivity";
import type { QuickSwitcherNavigationId } from "../features/quick-switcher/types";
import { projectQuickSwitcherSessionGroups } from "../features/quick-switcher/sessionProjection";
import type { SessionActivityEvent } from "../features/session-activity/types";
import type { AppMode, ThreadSummary, WorkspaceInfo } from "../types";

type QuickSwitcherShellBoundary = {
  activeWorkspaceId: string | null;
  threadsByWorkspace: Record<string, ThreadSummary[]>;
  workspaces: WorkspaceInfo[];
  activityTimeline: SessionActivityEvent[];
  isCompact: boolean;
  isSearchPaletteOpen: boolean;
  setIsSearchPaletteOpen: (open: boolean) => void;
  setActiveTab: (tab: "projects" | "codex" | "spec" | "git" | "log") => void;
  setActiveThreadId: (threadId: string, workspaceId: string) => void;
  setAppMode: (mode: AppMode) => void;
  setCenterMode: (mode: CenterMode) => void;
  setFilePanelMode: (mode: "git" | "files") => void;
  setGitPanelMode: (mode: "diff" | "log" | "issues" | "prs") => void;
  expandRightPanel: () => void;
  handleOpenFile: (
    path: string,
    location?: undefined,
    options?: { targetWorkspace?: WorkspaceInfo | null },
  ) => void;
  selectWorkspace: (workspaceId: string) => void;
  handleToggleTerminalPanel: () => void;
  openSettings: () => void;
};

export function useAppShellQuickSwitcherSection(
  input: QuickSwitcherShellBoundary,
) {
  const {
    activeWorkspaceId,
    activityTimeline,
    expandRightPanel,
    handleOpenFile,
    handleToggleTerminalPanel,
    isCompact,
    isSearchPaletteOpen,
    openSettings,
    selectWorkspace,
    setActiveTab,
    setActiveThreadId,
    setAppMode,
    setCenterMode,
    setFilePanelMode,
    setGitPanelMode,
    setIsSearchPaletteOpen,
    threadsByWorkspace,
    workspaces,
  } = input;
  const [isQuickSwitcherOpen, setIsQuickSwitcherOpen] = useState(false);

  useRecordRecentFilesFromActivity(activeWorkspaceId, activityTimeline);

  const quickSwitcherSessionGroups = useMemo(
    () => projectQuickSwitcherSessionGroups(workspaces, threadsByWorkspace),
    [threadsByWorkspace, workspaces],
  );

  const closeQuickSwitcher = useCallback(() => {
    setIsQuickSwitcherOpen(false);
  }, []);

  const handleOpenQuickSwitcher = useCallback(() => {
    setIsSearchPaletteOpen(false);
    setIsQuickSwitcherOpen(true);
  }, [setIsSearchPaletteOpen]);

  const handleToggleQuickSwitcher = useCallback(() => {
    setIsQuickSwitcherOpen((current) => !current);
    setIsSearchPaletteOpen(false);
  }, [setIsSearchPaletteOpen]);

  useGlobalSearchShortcut({
    isEnabled: !isCompact,
    shortcut: "cmd+e",
    onTrigger: handleToggleQuickSwitcher,
  });

  useEffect(() => {
    if (isSearchPaletteOpen) {
      setIsQuickSwitcherOpen(false);
    }
  }, [isSearchPaletteOpen]);

  const handleQuickSwitcherSelectSession = useCallback(
    (workspaceId: string, threadId: string) => {
      if (!workspaceId) {
        return;
      }
      setAppMode("chat");
      setActiveTab("codex");
      if (workspaceId !== activeWorkspaceId) {
        selectWorkspace(workspaceId);
      }
      setActiveThreadId(threadId, workspaceId);
      closeQuickSwitcher();
    }, [
      activeWorkspaceId,
      closeQuickSwitcher,
      selectWorkspace,
      setActiveTab,
      setActiveThreadId,
      setAppMode,
    ],
  );

  const handleQuickSwitcherSelectFile = useCallback(
    (workspaceId: string, path: string) => {
      const targetWorkspace = workspaces.find(
        (workspace) => workspace.id === workspaceId,
      );
      if (!targetWorkspace) {
        return;
      }
      if (workspaceId !== activeWorkspaceId) {
        selectWorkspace(workspaceId);
      }
      handleOpenFile(path, undefined, { targetWorkspace });
      closeQuickSwitcher();
    },
    [
      activeWorkspaceId,
      closeQuickSwitcher,
      handleOpenFile,
      selectWorkspace,
      workspaces,
    ],
  );

  const handleQuickSwitcherNavigate = useCallback(
    (target: QuickSwitcherNavigationId) => {
      switch (target) {
        case "chat":
          setAppMode("chat");
          setActiveTab("codex");
          setCenterMode("chat");
          break;
        case "files":
          setAppMode("chat");
          setCenterMode("chat");
          setFilePanelMode("files");
          expandRightPanel();
          break;
        case "git":
          setAppMode("chat");
          setFilePanelMode("git");
          setGitPanelMode("diff");
          expandRightPanel();
          break;
        case "history":
          setAppMode("gitHistory");
          break;
        case "kanban":
          setAppMode("kanban");
          break;
        case "spec":
        case "intentCanvas":
        case "projectMap":
          break;
        case "terminal":
          handleToggleTerminalPanel();
          break;
        case "settings":
          openSettings();
          break;
      }
      closeQuickSwitcher();
    },
    [
      closeQuickSwitcher,
      expandRightPanel,
      handleToggleTerminalPanel,
      openSettings,
      setActiveTab,
      setAppMode,
      setCenterMode,
      setFilePanelMode,
      setGitPanelMode,
    ],
  );

  return {
    closeQuickSwitcher,
    handleOpenQuickSwitcher,
    handleQuickSwitcherNavigate,
    handleQuickSwitcherSelectFile,
    handleQuickSwitcherSelectSession,
    isQuickSwitcherOpen,
    quickSwitcherSessionGroups,
  };
}
