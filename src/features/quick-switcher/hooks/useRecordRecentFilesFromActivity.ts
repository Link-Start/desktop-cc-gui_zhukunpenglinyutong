import { useEffect } from "react";
import type { SessionActivityEvent } from "../../session-activity/types";
import { recordQuickSwitcherAiFileChanges } from "../recentFiles";

export function useRecordRecentFilesFromActivity(
  workspaceId: string | null | undefined,
  timeline: SessionActivityEvent[],
) {
  useEffect(() => {
    recordQuickSwitcherAiFileChanges(workspaceId, timeline);
  }, [timeline, workspaceId]);
}
