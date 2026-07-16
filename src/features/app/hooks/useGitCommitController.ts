import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import type { WorkspaceInfo } from "../../../types";
import {
  type CommitMessageEngine,
  type CommitMessageLanguage,
  type CommitMessageRepositorySelection,
  commitGit,
  generateCommitMessageWithEngine,
  pushGit,
  stageGitFile,
  syncGit,
  unstageGitFile,
} from "../../../services/tauri";
import {
  sanitizeGeneratedCommitMessage,
  shouldApplyCommitMessage,
} from "../../../utils/commitMessage";
import { useGitStatus } from "../../git/hooks/useGitStatus";
import {
  runScopedCommitOperation,
  type CommitScopeStatusSnapshot,
} from "../../git/utils/commitScope";
import type { RepositoryGitStatus } from "../../git/hooks/useMultiRepositoryGitStatus";
import type { RepositoryCommitSelection } from "../../git/components/GitMultiRepositoryChanges";
import { runMultiRepositoryCommitOperations } from "../../git/utils/multiRepositoryCommit";

type GitStatusState = ReturnType<typeof useGitStatus>["status"];

type GitCommitControllerOptions = {
  activeWorkspace: WorkspaceInfo | null;
  activeWorkspaceId: string | null;
  activeWorkspaceIdRef: RefObject<string | null>;
  gitStatus: GitStatusState;
  refreshGitStatus: () => void;
  refreshGitLog?: () => void;
  onMutationComplete?: () => Promise<void> | void;
  repositoryStatuses?: RepositoryGitStatus[];
  refreshRepositoryStatuses?: () => Promise<void> | void;
};

type GitCommitController = {
  commitMessage: string;
  commitMessageLoading: boolean;
  commitMessageError: string | null;
  commitLoading: boolean;
  pushLoading: boolean;
  syncLoading: boolean;
  commitError: string | null;
  pushError: string | null;
  syncError: string | null;
  repositoryCommitSummary: string | null;
  hasWorktreeChanges: boolean;
  onCommitMessageChange: (value: string) => void;
  onGenerateCommitMessage: (
    language?: CommitMessageLanguage,
    engine?: CommitMessageEngine,
    selectedPaths?: string[],
    repositorySelections?: CommitMessageRepositorySelection[],
  ) => Promise<void>;
  onCommit: (selectedPaths?: string[]) => Promise<void>;
  onCommitAndPush: (selectedPaths?: string[]) => Promise<void>;
  onCommitAndSync: (selectedPaths?: string[]) => Promise<void>;
  onPush: () => Promise<void>;
  onSync: () => Promise<void>;
  onCommitRepositories: (selections: RepositoryCommitSelection[]) => Promise<void>;
  onCommitAndPushRepositories: (selections: RepositoryCommitSelection[]) => Promise<void>;
};

export function useGitCommitController({
  activeWorkspace,
  activeWorkspaceId,
  activeWorkspaceIdRef,
  gitStatus,
  refreshGitStatus,
  refreshGitLog,
  onMutationComplete,
  repositoryStatuses = [],
  refreshRepositoryStatuses,
}: GitCommitControllerOptions): GitCommitController {
  const { t } = useTranslation();
  const [commitMessage, setCommitMessage] = useState("");
  const [commitMessageLoading, setCommitMessageLoading] = useState(false);
  const [commitMessageError, setCommitMessageError] = useState<string | null>(
    null,
  );
  const [commitLoading, setCommitLoading] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [repositoryCommitSummary, setRepositoryCommitSummary] = useState<string | null>(null);

  const hasWorktreeChanges = useMemo(() => {
    const hasStagedChanges = gitStatus.stagedFiles.length > 0;
    const hasUnstagedChanges = gitStatus.unstagedFiles.length > 0;
    return hasStagedChanges || hasUnstagedChanges;
  }, [gitStatus.stagedFiles.length, gitStatus.unstagedFiles.length]);

  const handleCommitMessageChange = useCallback((value: string) => {
    setCommitMessage(value);
  }, []);

  const handleGenerateCommitMessage = useCallback(async (
    language: CommitMessageLanguage = "zh",
    engine: CommitMessageEngine = "codex",
    selectedPaths?: string[],
    repositorySelections?: CommitMessageRepositorySelection[],
  ) => {
    if (!activeWorkspace || commitMessageLoading) {
      return;
    }
    const workspaceId = activeWorkspace.id;
    setCommitMessageLoading(true);
    setCommitMessageError(null);
    try {
      const message = repositorySelections
        ? await generateCommitMessageWithEngine(
          workspaceId,
          language,
          engine,
          selectedPaths,
          repositorySelections,
        )
        : await generateCommitMessageWithEngine(
          workspaceId,
          language,
          engine,
          selectedPaths,
        );
      if (!shouldApplyCommitMessage(activeWorkspaceIdRef.current, workspaceId)) {
        return;
      }
      const cleanedMessage = sanitizeGeneratedCommitMessage(message);
      setCommitMessage(cleanedMessage);
    } catch (error) {
      if (!shouldApplyCommitMessage(activeWorkspaceIdRef.current, workspaceId)) {
        return;
      }
      const raw = error instanceof Error ? error.message : String(error);
      const isCodexRequired =
        engine === "codex" &&
        (raw.includes("requires the Codex CLI") ||
          raw.includes("workspace not connected"));
      setCommitMessageError(
        isCodexRequired ? t("git.commitMessageRequiresCodex") : raw,
      );
    } finally {
      if (shouldApplyCommitMessage(activeWorkspaceIdRef.current, workspaceId)) {
        setCommitMessageLoading(false);
      }
    }
  }, [activeWorkspace, commitMessageLoading, activeWorkspaceIdRef, t]);

  useEffect(() => {
    setCommitMessage("");
    setCommitMessageError(null);
    setCommitMessageLoading(false);
    setRepositoryCommitSummary(null);
  }, [activeWorkspaceId]);

  const runScopedCommit = useCallback(async (selectedPaths?: string[]) => {
    if (!activeWorkspace) {
      return { committed: false, postCommitError: null };
    }
    return runScopedCommitOperation({
      workspaceId: activeWorkspace.id,
      gitStatus: gitStatus as CommitScopeStatusSnapshot,
      selectedPaths,
      commitMessage,
      stageFile: stageGitFile,
      unstageFile: unstageGitFile,
      commit: commitGit,
      formatRestoreSelectionFailed: (error) =>
        t("git.commitRestoreSelectionFailed", { error }),
    });
  }, [activeWorkspace, commitMessage, gitStatus, t]);

  const handleCommit = useCallback(async (selectedPaths?: string[]) => {
    if (!activeWorkspace || commitLoading || !commitMessage.trim()) {
      return;
    }
    setCommitLoading(true);
    setCommitError(null);
    try {
      const result = await runScopedCommit(selectedPaths);
      if (!result.committed) {
        return;
      }
      setCommitMessage("");
      refreshGitStatus();
      refreshGitLog?.();
      await onMutationComplete?.();
      if (result.postCommitError) {
        setCommitError(result.postCommitError);
      }
    } catch (error) {
      setCommitError(error instanceof Error ? error.message : String(error));
    } finally {
      setCommitLoading(false);
    }
  }, [
    activeWorkspace,
    commitLoading,
    commitMessage,
    refreshGitLog,
    refreshGitStatus,
    onMutationComplete,
    runScopedCommit,
  ]);

  const handleCommitAndPush = useCallback(async (selectedPaths?: string[]) => {
    if (
      !activeWorkspace ||
      commitLoading ||
      pushLoading ||
      !commitMessage.trim()
    ) {
      return;
    }
    setCommitLoading(true);
    setPushLoading(true);
    setCommitError(null);
    setPushError(null);
    setRepositoryCommitSummary(null);
    let commitReadyForPush = false;
    try {
      const result = await runScopedCommit(selectedPaths);
      if (!result.committed) {
        return;
      }
      setCommitMessage("");
      await onMutationComplete?.();
      if (result.postCommitError) {
        setCommitError(result.postCommitError);
        refreshGitStatus();
        refreshGitLog?.();
        return;
      }
      commitReadyForPush = true;
      setCommitLoading(false);
      await pushGit(activeWorkspace.id);
      refreshGitStatus();
      refreshGitLog?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (commitReadyForPush) {
        setPushError(errorMessage);
      } else {
        setCommitError(errorMessage);
      }
    } finally {
      setCommitLoading(false);
      setPushLoading(false);
    }
  }, [
    activeWorkspace,
    commitLoading,
    pushLoading,
    commitMessage,
    refreshGitLog,
    refreshGitStatus,
    onMutationComplete,
    runScopedCommit,
  ]);

  const handleCommitAndSync = useCallback(async (selectedPaths?: string[]) => {
    if (
      !activeWorkspace ||
      commitLoading ||
      syncLoading ||
      !commitMessage.trim()
    ) {
      return;
    }
    setCommitLoading(true);
    setSyncLoading(true);
    setCommitError(null);
    setSyncError(null);
    let commitReadyForSync = false;
    try {
      const result = await runScopedCommit(selectedPaths);
      if (!result.committed) {
        return;
      }
      setCommitMessage("");
      await onMutationComplete?.();
      if (result.postCommitError) {
        setCommitError(result.postCommitError);
        refreshGitStatus();
        refreshGitLog?.();
        return;
      }
      commitReadyForSync = true;
      setCommitLoading(false);
      await syncGit(activeWorkspace.id);
      refreshGitStatus();
      refreshGitLog?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (commitReadyForSync) {
        setSyncError(errorMessage);
      } else {
        setCommitError(errorMessage);
      }
    } finally {
      setCommitLoading(false);
      setSyncLoading(false);
    }
  }, [
    activeWorkspace,
    commitLoading,
    syncLoading,
    commitMessage,
    refreshGitLog,
    refreshGitStatus,
    onMutationComplete,
    runScopedCommit,
  ]);

  const handlePush = useCallback(async () => {
    if (!activeWorkspace || pushLoading) {
      return;
    }
    setPushLoading(true);
    setPushError(null);
    try {
      await pushGit(activeWorkspace.id);
      refreshGitStatus();
      refreshGitLog?.();
      await onMutationComplete?.();
    } catch (error) {
      setPushError(error instanceof Error ? error.message : String(error));
    } finally {
      setPushLoading(false);
    }
  }, [activeWorkspace, onMutationComplete, pushLoading, refreshGitLog, refreshGitStatus]);

  const handleSync = useCallback(async () => {
    if (!activeWorkspace || syncLoading) {
      return;
    }
    setSyncLoading(true);
    setSyncError(null);
    try {
      await syncGit(activeWorkspace.id);
      refreshGitStatus();
      refreshGitLog?.();
      await onMutationComplete?.();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : String(error));
    } finally {
      setSyncLoading(false);
    }
  }, [activeWorkspace, onMutationComplete, refreshGitLog, refreshGitStatus, syncLoading]);

  const runRepositoryCommits = useCallback(async (
    selections: RepositoryCommitSelection[],
    pushAfterCommit: boolean,
  ) => {
    if (!activeWorkspace || commitLoading || !commitMessage.trim()) {
      return;
    }
    const statusByRoot = new Map(repositoryStatuses.map((status) => [status.repositoryRoot, status]));
    const repositories = selections.flatMap((selection) => {
      const status = statusByRoot.get(selection.repositoryRoot);
      return status ? [{
        repositoryRoot: status.repositoryRoot,
        displayName: status.displayName,
        gitStatus: status,
        selectedPaths: selection.selectedPaths,
      }] : [];
    });
    if (repositories.length === 0) {
      return;
    }
    setCommitLoading(true);
    setPushLoading(pushAfterCommit);
    setCommitError(null);
    setPushError(null);
    try {
      const outcomes = await runMultiRepositoryCommitOperations({
        workspaceId: activeWorkspace.id,
        commitMessage,
        repositories,
        pushAfterCommit,
        stageFile: stageGitFile,
        unstageFile: unstageGitFile,
        commit: commitGit,
        push: (workspaceId, repositoryRoot) => pushGit(workspaceId, undefined, repositoryRoot),
        formatRestoreSelectionFailed: (error) =>
          t("git.commitRestoreSelectionFailed", { error }),
      });
      const commitFailures = outcomes.filter((outcome) => outcome.commitError);
      const pushFailures = outcomes.filter((outcome) => outcome.pushError);
      const postCommitFailures = outcomes.filter((outcome) => outcome.postCommitError);
      setRepositoryCommitSummary(outcomes.map((outcome) => {
        const failed = Boolean(outcome.commitError || outcome.postCommitError || outcome.pushError);
        return `${outcome.displayName}: ${t(failed ? "common.error" : "common.success")}`;
      }).join(" · "));
      if (commitFailures.length === 0) {
        setCommitMessage("");
      } else {
        setCommitError(commitFailures.map((outcome) =>
          `${outcome.displayName}: ${outcome.commitError}`,
        ).join("\n"));
      }
      if (postCommitFailures.length > 0) {
        setCommitError(postCommitFailures.map((outcome) =>
          `${outcome.displayName}: ${outcome.postCommitError}`,
        ).join("\n"));
      }
      if (pushFailures.length > 0) {
        setPushError(pushFailures.map((outcome) =>
          `${outcome.displayName}: ${outcome.pushError}`,
        ).join("\n"));
      }
      await refreshRepositoryStatuses?.();
      await onMutationComplete?.();
      refreshGitStatus();
      refreshGitLog?.();
    } finally {
      setCommitLoading(false);
      setPushLoading(false);
    }
  }, [
    activeWorkspace,
    commitLoading,
    commitMessage,
    onMutationComplete,
    refreshGitLog,
    refreshGitStatus,
    refreshRepositoryStatuses,
    repositoryStatuses,
    t,
  ]);

  const handleCommitRepositories = useCallback(
    (selections: RepositoryCommitSelection[]) => runRepositoryCommits(selections, false),
    [runRepositoryCommits],
  );
  const handleCommitAndPushRepositories = useCallback(
    (selections: RepositoryCommitSelection[]) => runRepositoryCommits(selections, true),
    [runRepositoryCommits],
  );

  return {
    commitMessage,
    commitMessageLoading,
    commitMessageError,
    commitLoading,
    pushLoading,
    syncLoading,
    commitError,
    pushError,
    syncError,
    repositoryCommitSummary,
    hasWorktreeChanges,
    onCommitMessageChange: handleCommitMessageChange,
    onGenerateCommitMessage: handleGenerateCommitMessage,
    onCommit: handleCommit,
    onCommitAndPush: handleCommitAndPush,
    onCommitAndSync: handleCommitAndSync,
    onPush: handlePush,
    onSync: handleSync,
    onCommitRepositories: handleCommitRepositories,
    onCommitAndPushRepositories: handleCommitAndPushRepositories,
  };
}
