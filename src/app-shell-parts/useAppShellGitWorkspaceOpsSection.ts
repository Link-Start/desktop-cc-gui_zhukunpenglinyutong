import { useCallback } from "react";
import { useGitBranches } from "../features/git/hooks/useGitBranches";
import { useGitActions } from "../features/git/hooks/useGitActions";
import {
  buildDetachedFileExplorerSession,
  openOrFocusDetachedFileExplorer,
} from "../features/files/detachedFileExplorer";
import { pickWorkspacePath } from "../services/tauri";
import { resolveWorkspaceRelativePath } from "../utils/workspacePaths";
import { pushErrorToast } from "../services/toasts";
import type {
  DebugEntry,
  WorkspaceInfo,
  WorkspaceSettings,
} from "../types";

type GitWorkspaceOpsGitStatus = {
  isGitRepository: boolean;
  error: string | null;
  files: readonly unknown[];
};

type GitWorkspaceOpsSectionParams = {
  activeWorkspace: WorkspaceInfo | null;
  addDebugEntry: (entry: DebugEntry) => void;
  clearGitRootCandidates: () => void;
  gitStatus: GitWorkspaceOpsGitStatus;
  refreshGitDiffs: () => void;
  refreshGitStatus: () => void;
  t: (key: string, params?: Record<string, unknown>) => string;
  updateWorkspaceSettings: (
    workspaceId: string,
    patch: Partial<WorkspaceSettings>,
  ) => Promise<unknown>;
};

export function useAppShellGitWorkspaceOpsSection({
  activeWorkspace,
  addDebugEntry,
  clearGitRootCandidates,
  gitStatus,
  refreshGitDiffs,
  refreshGitStatus,
  t,
  updateWorkspaceSettings,
}: GitWorkspaceOpsSectionParams) {
  const { branches, checkoutBranch, createBranch } = useGitBranches({
    activeWorkspace,
    onDebug: addDebugEntry,
  });
  const handleCheckoutBranch = async (name: string) => {
    await checkoutBranch(name);
    refreshGitStatus();
  };
  const handleCreateBranch = async (name: string) => {
    await createBranch(name);
    refreshGitStatus();
  };
  const alertError = useCallback((error: unknown) => {
    alert(error instanceof Error ? error.message : String(error));
  }, []);
  const handleOpenDetachedFileExplorer = useCallback(
    async (initialFilePath?: string | null) => {
      if (!activeWorkspace) {
        return;
      }
      try {
        await openOrFocusDetachedFileExplorer(
          buildDetachedFileExplorerSession({
            workspaceId: activeWorkspace.id,
            workspacePath: activeWorkspace.path,
            workspaceName: activeWorkspace.name,
            gitRoot: activeWorkspace.settings.gitRoot ?? null,
            initialFilePath,
          }),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        pushErrorToast({
          title: t("files.openDetachedExplorer"),
          message,
        });
      }
    },
    [activeWorkspace, t],
  );
  const {
    applyWorktreeChanges: handleApplyWorktreeChanges,
    revertAllGitChanges: handleRevertAllGitChanges,
    revertGitFile: handleRevertGitFile,
    stageGitAll: handleStageGitAll,
    stageGitFile: handleStageGitFile,
    unstageGitFile: handleUnstageGitFile,
    worktreeApplyError,
    worktreeApplyLoading,
    worktreeApplySuccess,
  } = useGitActions({
    activeWorkspace,
    onRefreshGitStatus: refreshGitStatus,
    onRefreshGitDiffs: refreshGitDiffs,
    onError: alertError,
  });
  const activeGitRoot = activeWorkspace?.settings.gitRoot ?? null;
  const handleSetGitRoot = useCallback(
    async (path: string | null) => {
      if (!activeWorkspace) {
        return;
      }
      await updateWorkspaceSettings(activeWorkspace.id, {
        gitRoot: path,
      });
      clearGitRootCandidates();
      refreshGitStatus();
    },
    [
      activeWorkspace,
      clearGitRootCandidates,
      refreshGitStatus,
      updateWorkspaceSettings,
    ],
  );
  const handlePickGitRoot = useCallback(async () => {
    if (!activeWorkspace) {
      return;
    }
    const selection = await pickWorkspacePath();
    if (!selection) {
      return;
    }
    const relativeRoot = resolveWorkspaceRelativePath(
      activeWorkspace.path,
      selection,
    );
    const nextRoot = relativeRoot === "" ? null : relativeRoot;
    await handleSetGitRoot(nextRoot);
  }, [activeWorkspace, handleSetGitRoot]);
  const fileStatus = !gitStatus.isGitRepository
    ? t("git.noRepositoriesFound")
    : gitStatus.error
      ? t("git.statusUnavailable")
      : gitStatus.files.length > 0
        ? t("git.filesChanged", { count: gitStatus.files.length })
        : t("git.workingTreeClean");

  return {
    activeGitRoot,
    alertError,
    branches,
    checkoutBranch,
    createBranch,
    fileStatus,
    handleApplyWorktreeChanges,
    handleCheckoutBranch,
    handleCreateBranch,
    handleOpenDetachedFileExplorer,
    handlePickGitRoot,
    handleRevertAllGitChanges,
    handleRevertGitFile,
    handleSetGitRoot,
    handleStageGitAll,
    handleStageGitFile,
    handleUnstageGitFile,
    worktreeApplyError,
    worktreeApplyLoading,
    worktreeApplySuccess,
  };
}
