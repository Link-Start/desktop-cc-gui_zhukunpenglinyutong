import { useEffect, useState } from "react";
import {
  getQuickSwitcherRecentFileGroups,
  QUICK_SWITCHER_RECENT_FILES_CHANGED,
} from "../recentFiles";

export function useQuickSwitcherRecentFiles(
  workspaces: Array<{ id: string; name: string }>,
) {
  const [groups, setGroups] = useState(() =>
    getQuickSwitcherRecentFileGroups(workspaces),
  );

  useEffect(() => {
    const refresh = () =>
      setGroups((current) => {
        const next = getQuickSwitcherRecentFileGroups(workspaces);
        return JSON.stringify(current) === JSON.stringify(next) ? current : next;
      });
    refresh();
    window.addEventListener(QUICK_SWITCHER_RECENT_FILES_CHANGED, refresh);
    return () =>
      window.removeEventListener(QUICK_SWITCHER_RECENT_FILES_CHANGED, refresh);
  }, [workspaces]);

  return groups;
}
