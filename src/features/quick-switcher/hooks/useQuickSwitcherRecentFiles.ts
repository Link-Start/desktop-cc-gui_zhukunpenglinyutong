import { useEffect, useMemo, useRef, useState } from "react";
import {
  getQuickSwitcherRecentFilesSnapshot,
  projectQuickSwitcherRecentFileGroups,
  QUICK_SWITCHER_RECENT_FILES_CHANGED,
  type RecentFilesByWorkspace,
} from "../recentFiles";

type QuickSwitcherWorkspace = { id: string; name: string };

function workspaceCatalogsEqual(
  left: QuickSwitcherWorkspace[],
  right: QuickSwitcherWorkspace[],
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (workspace, index) =>
        workspace.id === right[index]?.id &&
        workspace.name === right[index]?.name,
    )
  );
}

function recentFileSnapshotsEqual(
  left: RecentFilesByWorkspace,
  right: RecentFilesByWorkspace,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function useQuickSwitcherRecentFiles(
  workspaces: QuickSwitcherWorkspace[],
) {
  const [recentFilesByWorkspace, setRecentFilesByWorkspace] = useState(() =>
    getQuickSwitcherRecentFilesSnapshot(),
  );
  const stableWorkspacesRef = useRef(workspaces);
  if (!workspaceCatalogsEqual(stableWorkspacesRef.current, workspaces)) {
    stableWorkspacesRef.current = workspaces;
  }
  const stableWorkspaces = stableWorkspacesRef.current;

  useEffect(() => {
    const refresh = () =>
      setRecentFilesByWorkspace((current) => {
        const next = getQuickSwitcherRecentFilesSnapshot();
        return recentFileSnapshotsEqual(current, next) ? current : next;
      });
    window.addEventListener(QUICK_SWITCHER_RECENT_FILES_CHANGED, refresh);
    refresh();
    return () =>
      window.removeEventListener(QUICK_SWITCHER_RECENT_FILES_CHANGED, refresh);
  }, []);

  return useMemo(
    () =>
      projectQuickSwitcherRecentFileGroups(
        recentFilesByWorkspace,
        stableWorkspaces,
      ),
    [recentFilesByWorkspace, stableWorkspaces],
  );
}
