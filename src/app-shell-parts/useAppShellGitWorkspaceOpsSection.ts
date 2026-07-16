import { useCallback, useEffect, useRef, useState } from "react";
import { useGitBranches } from "../features/git/hooks/useGitBranches";
import { useGitRepositories } from "../features/git/hooks/useGitRepositories";
import { useGitActions } from "../features/git/hooks/useGitActions";
import {
  buildDetachedFileExplorerSession,
  openOrFocusDetachedFileExplorer,
} from "../features/files/detachedFileExplorer";
import { pickWorkspacePath } from "../services/tauri";
import { resolveWorkspaceRelativePath } from "../utils/workspacePaths";
import { pushErrorToast } from "../services/toasts";
import { getGitBranchUpdateFeedback } from "../features/git/utils/gitBranchUpdateFeedback";
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
  const {
    repositories,
    error: repositoryError,
    isLoading: repositoriesLoading,
    refreshRepositories,
  } = useGitRepositories({
    activeWorkspace,
    onDebug: addDebugEntry,
  });
  const [selectedRepositoryRoot, setSelectedRepositoryRoot] = useState<string | null>(null);
  const updatingRepositoryBranchesRef = useRef(new Set<string>());
  const {
    branches,
    localBranches,
    remoteBranches,
    currentBranch,
    error: branchError,
    checkoutBranch,
    createBranch,
    updateBranch,
  } = useGitBranches({
    activeWorkspace,
    onDebug: addDebugEntry,
    repositoryRoot: selectedRepositoryRoot,
    onMutationComplete: refreshRepositories,
  });

  useEffect(() => {
    setSelectedRepositoryRoot(null);
  }, [activeWorkspace?.id]);

  useEffect(() => {
    if (repositories.length === 1) {
      setSelectedRepositoryRoot(repositories[0]?.repositoryRoot ?? "");
      return;
    }
    if (
      selectedRepositoryRoot !== null &&
      !repositories.some(
        (repository) => repository.repositoryRoot === selectedRepositoryRoot,
      )
    ) {
      setSelectedRepositoryRoot(null);
    }
  }, [repositories, selectedRepositoryRoot]);

  const selectRepository = useCallback((repositoryRoot: string | null) => {
    setSelectedRepositoryRoot(repositoryRoot);
  }, []);
  const handleCheckoutBranch = async (name: string) => {
    await checkoutBranch(name);
    refreshGitStatus();
  };
  const handleCreateBranch = async (name: string) => {
    await createBranch(name);
    refreshGitStatus();
  };
  const handleUpdateBranch = async (name: string, repositoryRootOverride?: string) => {
    const updateKey = repositoryRootOverride === undefined
      ? null
      : JSON.stringify([activeWorkspace?.id ?? null, repositoryRootOverride, name]);
    if (updateKey && updatingRepositoryBranchesRef.current.has(updateKey)) {
      return null;
    }
    if (updateKey) {
      updatingRepositoryBranchesRef.current.add(updateKey);
      pushErrorToast({
        id: updateKey,
        title: t("git.historyBranchMenuUpdate"),
        message: t("git.historyRunningOperation", {
          operation: t("git.historyBranchMenuUpdate"),
        }),
        variant: "info",
        sticky: true,
      });
    }
    try {
      const result = await updateBranch(name, repositoryRootOverride);
      refreshGitStatus();
      if (result && repositoryRootOverride !== undefined) {
        const feedback = getGitBranchUpdateFeedback(t, result, name);
        pushErrorToast({
          id: updateKey ?? undefined,
          title: t("git.historyBranchMenuUpdate"),
          message: feedback.message,
          variant: feedback.tone,
          durationMs: 4_000,
        });
      } else if (!result && updateKey) {
        pushErrorToast({
          id: updateKey,
          title: t("git.historyBranchMenuUpdate"),
          message: t("git.statusUnavailable"),
          variant: "error",
        });
      }
      return result;
    } catch (error) {
      if (repositoryRootOverride === undefined) throw error;
      pushErrorToast({
        id: updateKey ?? undefined,
        title: t("git.historyBranchMenuUpdate"),
        message: error instanceof Error ? error.message : String(error),
        variant: "error",
      });
      return null;
    } finally {
      if (updateKey) updatingRepositoryBranchesRef.current.delete(updateKey);
    }
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
    branchError,
    currentBranch,
    localBranches,
    remoteBranches,
    repositories,
    repositoriesLoading,
    repositoryError,
    refreshRepositories,
    selectedRepositoryRoot,
    selectRepository,
    checkoutBranch,
    createBranch,
    fileStatus,
    handleApplyWorktreeChanges,
    handleCheckoutBranch,
    handleCreateBranch,
    handleUpdateBranch,
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
