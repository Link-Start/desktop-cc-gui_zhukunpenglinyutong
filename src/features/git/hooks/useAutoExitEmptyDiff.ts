import { useEffect } from "react";
import type { CenterMode } from "../../app/hooks/useGitPanelController";

type AutoExitEmptyDiffOptions = {
  centerMode: CenterMode;
  autoExitEnabled: boolean;
  activeDiffCount: number;
  activeDiffLoading: boolean;
  activeDiffError: string | null;
  activeThreadId: string | null;
  isCompact: boolean;
  setCenterMode: (mode: CenterMode) => void;
  setSelectedDiffPath: (path: string | null) => void;
  setActiveTab: (tab: "projects" | "codex" | "spec" | "git" | "log") => void;
};

export function useAutoExitEmptyDiff({
  centerMode,
  autoExitEnabled,
  activeDiffCount,
  activeDiffLoading,
  activeDiffError,
  activeThreadId,
  isCompact,
  setCenterMode,
  setSelectedDiffPath,
  setActiveTab,
}: AutoExitEmptyDiffOptions) {
  useEffect(() => {
    if (centerMode !== "diff") {
      return;
    }
    if (!autoExitEnabled) {
      return;
    }
    if (activeDiffLoading || activeDiffError) {
      return;
    }
    if (activeDiffCount > 0) {
      return;
    }
    if (!activeThreadId) {
      return;
    }
    setCenterMode("chat");
    setSelectedDiffPath(null);
    if (isCompact) {
      setActiveTab("codex");
    }
  }, [
    activeDiffCount,
    activeDiffError,
    activeDiffLoading,
    autoExitEnabled,
    activeThreadId,
    centerMode,
    isCompact,
    setActiveTab,
    setCenterMode,
    setSelectedDiffPath,
  ]);
}
