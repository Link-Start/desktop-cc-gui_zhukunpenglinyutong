import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import CircleCheckBig from "lucide-react/dist/esm/icons/circle-check-big";
import SquarePen from "lucide-react/dist/esm/icons/square-pen";
import { DiffFileRow, DiffFolderRow } from "../../git/components/GitDiffPanelFileSections";
import { CommitMessageEngineIcon } from "../../git/components/CommitMessageEngineIcon";
import {
  CommitButton,
  useGitCommitSelection,
} from "../../git/components/GitDiffPanelCommitScope";
import {
  type InclusionState,
  getFileInclusionState,
} from "../../git/components/GitDiffPanelInclusion";
import { GitDiffPanelSectionActions } from "../../git/components/GitDiffPanelSectionActions";
import {
  type CommitMessageEngine,
  type CommitMessageLanguage,
  commitGit,
  generateCommitMessageWithEngine,
  getGitStatus,
  revertGitAll,
  revertGitFile,
  stageGitAll,
  stageGitFile,
  unstageGitFile,
} from "../../../services/tauri";
import type { GitFileStatus } from "../../../types";
import { sanitizeGeneratedCommitMessage } from "../../../utils/commitMessage";
import { localizeGitErrorMessage } from "../gitErrorI18n";
import { runScopedCommitOperation } from "../../git/utils/commitScope";
import {
  buildDiffTree,
  compactDiffTree,
  type DiffTreeFolderNode,
} from "../../git/utils/diffTree";
import {
  clampRendererContextMenuPosition,
  RendererContextMenu,
  type RendererContextMenuState,
} from "../../../components/ui/RendererContextMenu";

type GitHistoryWorktreePanelProps = {
  workspaceId: string;
  repositoryRoot?: string | null;
  listView: "flat" | "tree";
  commitSectionCollapsed?: boolean;
  rootFolderName?: string;
  onMutated?: () => void | Promise<void>;
  onOpenDiffPath?: (path: string) => void;
  onSummaryChange?: (summary: {
    changedFiles: number;
    totalAdditions: number;
    totalDeletions: number;
  }) => void;
};

type GitStatusState = {
  branchName: string;
  files: GitFileStatus[];
  stagedFiles: GitFileStatus[];
  unstagedFiles: GitFileStatus[];
  totalAdditions: number;
  totalDeletions: number;
};

type DiffSection = "staged" | "unstaged";

type DiffTreeNode = DiffTreeFolderNode<GitFileStatus>;

type CollapsedFolder = {
  key: string;
  name: string;
  iconName: string;
  node: DiffTreeNode;
};

const EMPTY_STATUS: GitStatusState = {
  branchName: "",
  files: [],
  stagedFiles: [],
  unstagedFiles: [],
  totalAdditions: 0,
  totalDeletions: 0,
};

function getPathLeafName(path: string | null | undefined): string {
  if (!path) {
    return "";
  }
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  if (!normalized) {
    return "";
  }
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

function getTreeLineOpacity(depth: number): string {
  return depth === 1 ? "1" : "0";
}

function collapseFolderChain(node: DiffTreeNode): CollapsedFolder {
  return {
    key: node.key,
    name: node.name,
    iconName: node.path || node.name,
    node,
  };
}

function normalizeErrorMessage(
  raw: string | null,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  const localized = localizeGitErrorMessage(raw, t);
  if (!raw) {
    return localized;
  }
  const isCodexRequired =
    raw.includes("requires the Codex CLI") || raw.includes("workspace not connected");
  if (isCodexRequired) {
    return t("git.commitMessageRequiresCodex");
  }
  return localized;
}

function renderSectionIndicator(
  section: DiffSection,
  count: number,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  const label = section === "staged" ? t("git.staged") : t("git.unstaged");
  const Icon = section === "staged" ? CircleCheckBig : SquarePen;
  return (
    <span
      className={`git-history-worktree-section-indicator is-${section}`}
      aria-label={`${label} (${count})`}
      title={label}
    >
      <Icon size={12} aria-hidden />
      <strong>{count}</strong>
    </span>
  );
}

function getGroupInclusionState(
  paths: string[],
  includedPaths: Set<string>,
  excludedPaths: Set<string>,
  partialPaths: Set<string>,
): InclusionState {
  if (paths.length === 0) {
    return "none";
  }
  let hasIncluded = false;
  let hasExcluded = false;
  for (const path of paths) {
    const state = getFileInclusionState(
      path,
      includedPaths,
      excludedPaths,
      partialPaths,
    );
    if (state === "partial") {
      return "partial";
    }
    if (state === "all") {
      hasIncluded = true;
    } else {
      hasExcluded = true;
    }
    if (hasIncluded && hasExcluded) {
      return "partial";
    }
  }
  return hasIncluded ? "all" : "none";
}

export function GitHistoryWorktreePanel({
  workspaceId,
  repositoryRoot = null,
  listView,
  commitSectionCollapsed = false,
  rootFolderName,
  onMutated,
  onOpenDiffPath,
  onSummaryChange,
}: GitHistoryWorktreePanelProps) {
  const { t } = useTranslation();
  const requestIdRef = useRef(0);
  const resolvedRootFolderName = useMemo(
    () => rootFolderName?.trim() || getPathLeafName(workspaceId) || workspaceId,
    [rootFolderName, workspaceId],
  );
  const scopedStageGitFile = useCallback(
    (targetWorkspaceId: string, path: string) =>
      repositoryRoot === null
        ? stageGitFile(targetWorkspaceId, path)
        : stageGitFile(targetWorkspaceId, path, repositoryRoot),
    [repositoryRoot],
  );
  const scopedStageGitAll = useCallback(
    (targetWorkspaceId: string) =>
      repositoryRoot === null
        ? stageGitAll(targetWorkspaceId)
        : stageGitAll(targetWorkspaceId, repositoryRoot),
    [repositoryRoot],
  );
  const scopedUnstageGitFile = useCallback(
    (targetWorkspaceId: string, path: string) =>
      repositoryRoot === null
        ? unstageGitFile(targetWorkspaceId, path)
        : unstageGitFile(targetWorkspaceId, path, repositoryRoot),
    [repositoryRoot],
  );
  const scopedRevertGitFile = useCallback(
    (targetWorkspaceId: string, path: string) =>
      repositoryRoot === null
        ? revertGitFile(targetWorkspaceId, path)
        : revertGitFile(targetWorkspaceId, path, repositoryRoot),
    [repositoryRoot],
  );
  const scopedRevertGitAll = useCallback(
    (targetWorkspaceId: string) =>
      repositoryRoot === null
        ? revertGitAll(targetWorkspaceId)
        : revertGitAll(targetWorkspaceId, repositoryRoot),
    [repositoryRoot],
  );
  const scopedCommitGit = useCallback(
    (targetWorkspaceId: string, message: string) =>
      repositoryRoot === null
        ? commitGit(targetWorkspaceId, message)
        : commitGit(targetWorkspaceId, message, repositoryRoot),
    [repositoryRoot],
  );

  const [status, setStatus] = useState<GitStatusState>(EMPTY_STATUS);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [operationLoading, setOperationLoading] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [discardDialogPaths, setDiscardDialogPaths] = useState<string[] | null>(null);
  const [discardAllDialogOpen, setDiscardAllDialogOpen] = useState(false);

  const [commitMessage, setCommitMessage] = useState("");
  const [commitMessageLoading, setCommitMessageLoading] = useState(false);
  const [commitMessageError, setCommitMessageError] = useState<string | null>(null);
  const [commitLoading, setCommitLoading] = useState(false);
  const [commitMessageMenuEngine, setCommitMessageMenuEngine] = useState<CommitMessageEngine>("claude");
  const [commitMessageContextMenu, setCommitMessageContextMenu] =
    useState<RendererContextMenuState | null>(null);
  const deferredCommitLanguageMenuTimerRef = useRef<number | null>(null);

  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  const refreshStatus = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    try {
      const next = repositoryRoot === null
        ? await getGitStatus(workspaceId)
        : await getGitStatus(workspaceId, repositoryRoot);
      if (requestIdRef.current !== requestId) {
        return;
      }
      setStatus({
        branchName: next.branchName,
        files: next.files,
        stagedFiles: next.stagedFiles,
        unstagedFiles: next.unstagedFiles,
        totalAdditions: next.totalAdditions,
        totalDeletions: next.totalDeletions,
      });
      onSummaryChange?.({
        changedFiles: next.files.length,
        totalAdditions: next.totalAdditions,
        totalDeletions: next.totalDeletions,
      });
      setStatusError(null);
    } catch (error) {
      if (requestIdRef.current !== requestId) {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      setStatusError(message);
    }
  }, [onSummaryChange, repositoryRoot, workspaceId]);

  useEffect(() => {
    requestIdRef.current += 1;
    setStatus(EMPTY_STATUS);
    onSummaryChange?.({
      changedFiles: 0,
      totalAdditions: 0,
      totalDeletions: 0,
    });
    setStatusError(null);
    setOperationError(null);
    setCommitMessage("");
    setCommitMessageError(null);
    setCommitMessageContextMenu(null);
    setDiscardDialogPaths(null);
    setCollapsedFolders(new Set());
    setDiscardAllDialogOpen(false);
    void refreshStatus();
    const timer = window.setInterval(() => {
      void refreshStatus();
    }, 3000);
    return () => {
      window.clearInterval(timer);
    };
  }, [onSummaryChange, refreshStatus]);

  useEffect(() => {
    return () => {
      if (deferredCommitLanguageMenuTimerRef.current !== null) {
        window.clearTimeout(deferredCommitLanguageMenuTimerRef.current);
        deferredCommitLanguageMenuTimerRef.current = null;
      }
    };
  }, []);

  const handleMutation = useCallback(
    async (operation: () => Promise<unknown> | void) => {
      setOperationError(null);
      setOperationLoading(true);
      try {
        await operation();
        await refreshStatus();
        await onMutated?.();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setOperationError(message);
      } finally {
        setOperationLoading(false);
      }
    },
    [onMutated, refreshStatus],
  );

  const discardFiles = useCallback(
    async (paths: string[]) => {
      if (!paths.length) {
        return;
      }
      if (operationLoading) {
        return;
      }
      setDiscardDialogPaths(paths);
    },
    [operationLoading],
  );

  const handleConfirmDiscardFiles = useCallback(async () => {
    if (operationLoading || !discardDialogPaths || discardDialogPaths.length === 0) {
      return;
    }
    const targetPaths = [...discardDialogPaths];
    setDiscardDialogPaths(null);
    await handleMutation(async () => {
      for (const path of targetPaths) {
        await scopedRevertGitFile(workspaceId, path);
      }
    });
  }, [
    discardDialogPaths,
    handleMutation,
    operationLoading,
    scopedRevertGitFile,
    workspaceId,
  ]);

  const handleDiscardAll = useCallback(() => {
    if (operationLoading || status.unstagedFiles.length === 0) {
      return;
    }
    setDiscardAllDialogOpen(true);
  }, [operationLoading, status.unstagedFiles.length]);

  const handleConfirmDiscardAll = useCallback(async () => {
    if (operationLoading) {
      return;
    }
    setDiscardAllDialogOpen(false);
    await handleMutation(() => scopedRevertGitAll(workspaceId));
  }, [handleMutation, operationLoading, scopedRevertGitAll, workspaceId]);

  const hasWorktreeChanges = status.stagedFiles.length > 0 || status.unstagedFiles.length > 0;
  const stagedFiles = useMemo(
    () => status.stagedFiles.slice().sort((left, right) => left.path.localeCompare(right.path)),
    [status.stagedFiles],
  );
  const unstagedFiles = useMemo(
    () => status.unstagedFiles.slice().sort((left, right) => left.path.localeCompare(right.path)),
    [status.unstagedFiles],
  );
  const {
    selectedCommitPaths,
    selectedCommitCount,
    hasExplicitCommitSelection,
    includedCommitPaths,
    excludedCommitPaths,
    partialCommitPaths,
    isCommitPathLocked,
    setCommitSelection,
  } = useGitCommitSelection({
    stagedFiles,
    unstagedFiles,
  });
  const includedCommitPathSet = useMemo(
    () => new Set(includedCommitPaths),
    [includedCommitPaths],
  );
  const excludedCommitPathSet = useMemo(
    () => new Set(excludedCommitPaths),
    [excludedCommitPaths],
  );
  const partialCommitPathSet = useMemo(
    () => new Set(partialCommitPaths),
    [partialCommitPaths],
  );
  const stagedFilePaths = useMemo(
    () => stagedFiles.map((file) => file.path),
    [stagedFiles],
  );
  const unstagedFilePaths = useMemo(
    () => unstagedFiles.map((file) => file.path),
    [unstagedFiles],
  );
  const stagedToggleablePaths = useMemo(
    () => stagedFilePaths.filter((path) => !isCommitPathLocked(path)),
    [isCommitPathLocked, stagedFilePaths],
  );
  const unstagedToggleablePaths = useMemo(
    () => unstagedFilePaths.filter((path) => !isCommitPathLocked(path)),
    [isCommitPathLocked, unstagedFilePaths],
  );
  const stagedSectionInclusionState = useMemo(
    () =>
      getGroupInclusionState(
        stagedFilePaths,
        includedCommitPathSet,
        excludedCommitPathSet,
        partialCommitPathSet,
      ),
    [
      excludedCommitPathSet,
      includedCommitPathSet,
      partialCommitPathSet,
      stagedFilePaths,
    ],
  );
  const unstagedSectionInclusionState = useMemo(
    () =>
      getGroupInclusionState(
        unstagedFilePaths,
        includedCommitPathSet,
        excludedCommitPathSet,
        partialCommitPathSet,
      ),
    [
      excludedCommitPathSet,
      includedCommitPathSet,
      partialCommitPathSet,
      unstagedFilePaths,
    ],
  );
  const hasStagedFiles = stagedFiles.length > 0;
  const hasUnstagedFiles = unstagedFiles.length > 0;

  const handleGenerateCommitMessage = useCallback(
    async (
      language: CommitMessageLanguage = "zh",
      engine: CommitMessageEngine = "codex",
      selectedPaths?: string[],
    ) => {
      if (commitMessageLoading || commitLoading) {
        return;
      }
      setCommitMessageError(null);
      setCommitMessageLoading(true);
      try {
        const generated = repositoryRoot === null
          ? await generateCommitMessageWithEngine(
              workspaceId,
              language,
              engine,
              selectedPaths,
            )
          : await generateCommitMessageWithEngine(
              workspaceId,
              language,
              engine,
              undefined,
              [{
                repositoryRoot,
                selectedPaths: selectedPaths ?? status.files.map((file) => file.path),
              }],
            );
        setCommitMessage(sanitizeGeneratedCommitMessage(generated));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setCommitMessageError(message);
      } finally {
        setCommitMessageLoading(false);
      }
    },
    [commitLoading, commitMessageLoading, repositoryRoot, status.files, workspaceId],
  );

  const showCommitMessageLanguageMenu = useCallback(
    (engine: CommitMessageEngine, position: { x: number; y: number }) => {
      if (commitMessageLoading || commitLoading || operationLoading) {
        return;
      }
      const selectedPathsForGeneration =
        selectedCommitCount > 0
          ? selectedCommitPaths
          : hasExplicitCommitSelection
            ? []
            : undefined;
      setCommitMessageContextMenu({
        ...position,
        label: t("git.generateCommitMessage"),
        items: [
          {
            type: "item",
            id: "commit-message-zh",
            label: t("git.generateCommitMessageChinese"),
            onSelect: async () => {
              setCommitMessageMenuEngine(engine);
              await handleGenerateCommitMessage("zh", engine, selectedPathsForGeneration);
            },
          },
          {
            type: "item",
            id: "commit-message-en",
            label: t("git.generateCommitMessageEnglish"),
            onSelect: async () => {
              setCommitMessageMenuEngine(engine);
              await handleGenerateCommitMessage("en", engine, selectedPathsForGeneration);
            },
          },
        ],
      });
    },
    [
      commitLoading,
      commitMessageLoading,
      handleGenerateCommitMessage,
      operationLoading,
      selectedCommitCount,
      selectedCommitPaths,
      hasExplicitCommitSelection,
      t,
    ],
  );
  const showCommitMessageEngineMenu = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (commitMessageLoading || commitLoading || operationLoading) {
        return;
      }
      const position = clampRendererContextMenuPosition(event.clientX, event.clientY, {
        width: 260,
        height: 180,
      });
      const engineItems: Array<{ engine: CommitMessageEngine; label: string }> = [
        { engine: "codex", label: t("git.generateCommitMessageEngineCodex") },
        { engine: "claude", label: t("git.generateCommitMessageEngineClaude") },
      ];
      setCommitMessageContextMenu({
        ...position,
        label: t("git.generateCommitMessage"),
        items: engineItems.map(({ engine, label }) => ({
          type: "item",
          id: `commit-message-engine-${engine}`,
          label,
          onSelect: () => {
            if (deferredCommitLanguageMenuTimerRef.current !== null) {
              window.clearTimeout(deferredCommitLanguageMenuTimerRef.current);
            }
            deferredCommitLanguageMenuTimerRef.current = window.setTimeout(() => {
              deferredCommitLanguageMenuTimerRef.current = null;
              showCommitMessageLanguageMenu(engine, position);
            }, 0);
          },
        })),
      });
    },
    [commitLoading, commitMessageLoading, operationLoading, showCommitMessageLanguageMenu, t],
  );
  const handleCommit = useCallback(
    async (selectedPaths?: string[]) => {
      if (
        commitLoading ||
        operationLoading ||
        commitMessageLoading ||
        !commitMessage.trim()
      ) {
        return;
      }
      setCommitMessageError(null);
      setCommitLoading(true);
      try {
        const result = await runScopedCommitOperation({
          workspaceId,
          gitStatus: {
            stagedFiles: status.stagedFiles,
            unstagedFiles: status.unstagedFiles,
          },
          selectedPaths: selectedPaths ?? selectedCommitPaths,
          commitMessage,
          stageFile: scopedStageGitFile,
          unstageFile: scopedUnstageGitFile,
          commit: scopedCommitGit,
          formatRestoreSelectionFailed: (error) =>
            t("git.commitRestoreSelectionFailed", { error }),
        });
        if (!result.committed) {
          return;
        }
        setCommitMessage("");
        await refreshStatus();
        await onMutated?.();
        if (result.postCommitError) {
          setCommitMessageError(result.postCommitError);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setCommitMessageError(message);
      } finally {
        setCommitLoading(false);
      }
    },
    [
      commitLoading,
      commitMessage,
      commitMessageLoading,
      onMutated,
      operationLoading,
      refreshStatus,
      scopedCommitGit,
      scopedStageGitFile,
      scopedUnstageGitFile,
      selectedCommitPaths,
      status.stagedFiles,
      status.unstagedFiles,
      t,
      workspaceId,
    ],
  );
  const revertAllPreviewPaths = useMemo(
    () => status.files.map((file) => file.path).slice().sort((left, right) => left.localeCompare(right)),
    [status.files],
  );

  const statusErrorText = normalizeErrorMessage(statusError, t);
  const operationErrorText = normalizeErrorMessage(operationError, t);
  const commitMessageErrorText = normalizeErrorMessage(commitMessageError, t);
  const shouldShowFileSections = hasStagedFiles || hasUnstagedFiles;
  const worktreeSectionsClassName = `git-history-worktree-sections${
    hasStagedFiles !== hasUnstagedFiles ? " is-single" : ""
  }`;
  const visibleSectionCount = Number(hasStagedFiles) + Number(hasUnstagedFiles);
  const compactSection =
    visibleSectionCount === 1
      ? hasStagedFiles
        ? "staged"
        : "unstaged"
      : null;
  const compactSummaryLabel =
    compactSection === "staged"
      ? renderSectionIndicator("staged", stagedFiles.length, t)
      : compactSection === "unstaged"
        ? renderSectionIndicator("unstaged", unstagedFiles.length, t)
        : null;
  const compactSummaryBranch = status.branchName || resolvedRootFolderName;
  const commitStatusHint = selectedCommitCount > 0
    ? t("git.selectedFilesForCommit", { count: selectedCommitCount })
    : hasWorktreeChanges
      ? t("git.selectFilesToCommit")
      : t("git.noChangesToCommit");

  const toggleFolder = useCallback((key: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const renderFileRow = useCallback(
    (file: GitFileStatus, section: DiffSection, depth = 0) => {
      const inclusionState = getFileInclusionState(
        file.path,
        includedCommitPathSet,
        excludedCommitPathSet,
        partialCommitPathSet,
      );
      return (
        <DiffFileRow
          key={`${section}:${file.path}`}
          file={file}
          className="git-history-worktree-file-row"
          inclusionClassName="git-history-worktree-row-selection"
          statsClassName="git-history-worktree-file-stats"
          showStats
          section={section}
          isSelected={false}
          isActive={false}
          inclusionState={inclusionState}
          inclusionDisabled={isCommitPathLocked(file.path) || operationLoading}
          treeItem={listView === "tree"}
          treeDepth={depth + 1}
          indentLevel={depth * 2}
          showDirectory={listView === "flat"}
          onClick={() => onOpenDiffPath?.(file.path)}
          onKeySelect={() => onOpenDiffPath?.(file.path)}
          onOpenPreview={() => onOpenDiffPath?.(file.path)}
          onContextMenu={() => undefined}
          onStageFile={section === "unstaged" ? (path) => handleMutation(() => scopedStageGitFile(workspaceId, path)) : undefined}
          onUnstageFile={section === "staged" ? (path) => handleMutation(() => scopedUnstageGitFile(workspaceId, path)) : undefined}
          onDiscardFile={section === "unstaged" ? (path) => discardFiles([path]) : undefined}
          onSetCommitSelection={setCommitSelection}
        />
      );
    },
    [
      discardFiles,
      excludedCommitPathSet,
      handleMutation,
      includedCommitPathSet,
      isCommitPathLocked,
      listView,
      onOpenDiffPath,
      operationLoading,
      partialCommitPathSet,
      scopedStageGitFile,
      scopedUnstageGitFile,
      setCommitSelection,
      workspaceId,
    ],
  );

  const renderTreeRows = useCallback(
    (files: GitFileStatus[], section: DiffSection) => {
      const tree = compactDiffTree(buildDiffTree(files, section));
      const rootFolderKey = `${section}:__repo_root__/`;
      const rootCollapsed = collapsedFolders.has(rootFolderKey);
      const walk = (node: DiffTreeNode, depth: number): ReactNode[] => {
        const rows: ReactNode[] = [];
        const folders = Array.from(node.folders.values()).sort((a, b) => a.name.localeCompare(b.name));
        for (const folder of folders) {
          const collapsedFolder = collapseFolderChain(folder);
          const collapsed = collapsedFolders.has(collapsedFolder.key);
          const childTreeStyle = {
            ["--git-tree-branch-x" as string]: `${Math.max((depth + 1) * 16 - 7, 0)}px`,
            ["--git-tree-branch-opacity" as string]: getTreeLineOpacity(depth + 1),
          } as CSSProperties;
          rows.push(
            <div key={collapsedFolder.key} className="git-history-worktree-folder-group">
              <DiffFolderRow
                name={collapsedFolder.name}
                iconName={collapsedFolder.iconName}
                depth={depth}
                indentStep={16}
                collapsed={collapsed}
                className="git-history-worktree-folder-row"
                onToggle={() => toggleFolder(collapsedFolder.key)}
              />
              {!collapsed ? (
                <div
                  className="git-history-worktree-folder-children diff-tree-folder-children"
                  style={childTreeStyle}
                >
                  {walk(collapsedFolder.node, depth + 1)}
                </div>
              ) : null}
            </div>,
          );
        }

        const leafFiles = node.files.slice().sort((a, b) => a.path.localeCompare(b.path));
        for (const file of leafFiles) {
          rows.push(renderFileRow(file, section, depth));
        }

        return rows;
      };

      const rootChildrenStyle = {
        ["--git-tree-branch-x" as string]: `${Math.max(1 * 16 - 7, 0)}px`,
        ["--git-tree-branch-opacity" as string]: getTreeLineOpacity(1),
      } as CSSProperties;

      return [
        <div key={rootFolderKey} className="git-history-worktree-folder-group">
          <DiffFolderRow
            name={resolvedRootFolderName}
            depth={0}
            indentStep={16}
            collapsed={rootCollapsed}
            className="git-history-worktree-folder-row"
            onToggle={() => toggleFolder(rootFolderKey)}
          />
          {!rootCollapsed ? (
            <div
              className="git-history-worktree-folder-children diff-tree-folder-children"
              style={rootChildrenStyle}
            >
              {walk(tree, 1)}
            </div>
          ) : null}
        </div>,
      ];
    },
    [
      collapsedFolders,
      renderFileRow,
      resolvedRootFolderName,
      toggleFolder,
    ],
  );

  const renderSectionRows = useCallback(
    (files: GitFileStatus[], section: DiffSection) => {
      if (!files.length) {
        return <div className="git-history-empty">{t("git.noChangesDetected")}</div>;
      }
      if (listView === "tree") {
        return renderTreeRows(files, section);
      }
      return files.map((file) => renderFileRow(file, section));
    },
    [listView, renderFileRow, renderTreeRows, t],
  );

  return (
    <div className="git-history-worktree-panel">
      {!commitSectionCollapsed ? (
        <div className="git-history-worktree-commit-box commit-message-section">
          <div className="git-history-worktree-commit-input-wrap commit-message-input-wrapper">
            <textarea
              className="git-history-worktree-commit-input commit-message-input"
              placeholder={t("git.commitMessage")}
              value={commitMessage}
              onChange={(event) => setCommitMessage(event.target.value)}
              disabled={commitMessageLoading || commitLoading || operationLoading}
              rows={2}
            />
            <button
              type="button"
              className={`git-history-worktree-generate commit-message-generate-button${
                commitMessageLoading ? " git-history-worktree-generate--loading commit-message-generate-button--loading" : ""
              }`}
              onClick={(event) => {
                void showCommitMessageEngineMenu(event);
              }}
              disabled={commitMessageLoading || commitLoading || operationLoading || !hasWorktreeChanges}
              aria-haspopup="menu"
              title={
                stagedFiles.length > 0
                  ? t("git.generateCommitMessageStaged")
                  : t("git.generateCommitMessageUnstaged")
              }
              aria-label={t("git.generateCommitMessage")}
            >
              <CommitMessageEngineIcon
                engine={commitMessageMenuEngine}
                size={14}
                className={`git-history-worktree-engine-icon commit-message-engine-icon${
                  commitMessageLoading ? " git-history-worktree-engine-icon--spinning commit-message-engine-icon--spinning" : ""
                }`}
              />
            </button>
          </div>
          {hasWorktreeChanges ? (
            <div className="git-history-worktree-commit-hint commit-message-hint" aria-live="polite">
              {commitStatusHint}
            </div>
          ) : null}
          <CommitButton
            commitMessage={commitMessage}
            selectedCount={selectedCommitCount}
            hasAnyChanges={hasWorktreeChanges}
            commitLoading={commitLoading}
            selectedPaths={selectedCommitPaths}
            onCommit={handleCommit}
          />
        </div>
      ) : null}
      {statusErrorText ? <div className="git-history-error">{statusErrorText}</div> : null}
      {operationErrorText ? <div className="git-history-error">{operationErrorText}</div> : null}
      {commitMessageErrorText ? <div className="git-history-error">{commitMessageErrorText}</div> : null}

      {shouldShowFileSections ? (
        <div className={worktreeSectionsClassName}>
          {compactSection && compactSummaryLabel ? (
            <div className="git-history-worktree-summary-bar">
              <span
                className="git-history-worktree-summary-lines"
                aria-label={`+${status.totalAdditions} -${status.totalDeletions}`}
              >
                <span className="git-history-diff-add">+{status.totalAdditions}</span>
                <span className="git-history-diff-sep" aria-hidden>
                  /
                </span>
                <span className="git-history-diff-del">-{status.totalDeletions}</span>
              </span>
              <span className="git-history-worktree-summary-branch" title={compactSummaryBranch}>
                <strong>{compactSummaryBranch}</strong>
              </span>
              <span className="git-history-worktree-summary-label">{compactSummaryLabel}</span>
              <GitDiffPanelSectionActions
                title={compactSection === "staged" ? t("git.staged") : t("git.unstaged")}
                section={compactSection}
                sectionInclusionState={
                  compactSection === "staged"
                    ? stagedSectionInclusionState
                    : unstagedSectionInclusionState
                }
                toggleableFilePaths={
                  compactSection === "staged"
                    ? stagedToggleablePaths
                    : unstagedToggleablePaths
                }
                filePaths={compactSection === "staged" ? stagedFilePaths : unstagedFilePaths}
                onSetCommitSelection={setCommitSelection}
                onStageAllChanges={
                  compactSection === "unstaged"
                    ? () => handleMutation(() => scopedStageGitAll(workspaceId))
                    : undefined
                }
                onUnstageFile={
                  compactSection === "staged"
                    ? (path) => handleMutation(() => scopedUnstageGitFile(workspaceId, path))
                    : undefined
                }
                onDiscardFiles={
                  compactSection === "unstaged"
                    ? () => {
                        handleDiscardAll();
                      }
                    : undefined
                }
              />
            </div>
          ) : null}
          {hasStagedFiles ? (
            <div className="git-history-worktree-section git-filetree-section">
              <div
                className="git-history-worktree-section-header git-filetree-section-header"
                hidden={compactSection === "staged"}
              >
                <span>{renderSectionIndicator("staged", stagedFiles.length, t)}</span>
                <GitDiffPanelSectionActions
                  title={t("git.staged")}
                  section="staged"
                  sectionInclusionState={stagedSectionInclusionState}
                  toggleableFilePaths={stagedToggleablePaths}
                  filePaths={stagedFilePaths}
                  onSetCommitSelection={setCommitSelection}
                  onUnstageFile={(path) => handleMutation(() => scopedUnstageGitFile(workspaceId, path))}
                />
              </div>
              <div
                className={`git-history-worktree-section-list git-filetree-list${
                  listView === "tree" ? " diff-section-tree-list git-filetree-list--tree" : ""
                }`}
              >
                {renderSectionRows(stagedFiles, "staged")}
              </div>
            </div>
          ) : null}

          {hasUnstagedFiles ? (
            <div className="git-history-worktree-section git-filetree-section">
              <div
                className="git-history-worktree-section-header git-filetree-section-header"
                hidden={compactSection === "unstaged"}
              >
                <span>{renderSectionIndicator("unstaged", unstagedFiles.length, t)}</span>
                <GitDiffPanelSectionActions
                  title={t("git.unstaged")}
                  section="unstaged"
                  sectionInclusionState={unstagedSectionInclusionState}
                  toggleableFilePaths={unstagedToggleablePaths}
                  filePaths={unstagedFilePaths}
                  onSetCommitSelection={setCommitSelection}
                  onStageAllChanges={() => handleMutation(() => scopedStageGitAll(workspaceId))}
                  onDiscardFiles={() => {
                    handleDiscardAll();
                  }}
                />
              </div>
              <div
                className={`git-history-worktree-section-list git-filetree-list${
                  listView === "tree" ? " diff-section-tree-list git-filetree-list--tree" : ""
                }`}
              >
                {renderSectionRows(unstagedFiles, "unstaged")}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="git-history-empty">{t("git.noChangesDetected")}</div>
      )}
      {discardAllDialogOpen ? (
        <div
          className="git-history-create-branch-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !operationLoading) {
              setDiscardAllDialogOpen(false);
            }
          }}
        >
          <div
            className="git-history-worktree-danger-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={t("git.revertAllTitle")}
          >
            <div className="git-history-create-branch-title">{t("git.revertAllTitle")}</div>
            <div className="git-history-worktree-danger-copy">
              <p>{t("git.revertAllBeginnerLead")}</p>
              <div className="git-history-worktree-danger-list">
                <div className="git-history-worktree-danger-list-title">{t("git.revertAllAffectsLabel")}</div>
                <ul>
                  <li>
                    <span className="git-history-danger-keyword">{t("git.revertAllKeywordStaged")}</span>
                  </li>
                  <li>
                    <span className="git-history-danger-keyword">{t("git.revertAllKeywordUnstaged")}</span>
                  </li>
                  <li>
                    <span className="git-history-danger-keyword">{t("git.revertAllKeywordUntracked")}</span>
                  </li>
                </ul>
              </div>
              <div className="git-history-worktree-danger-list">
                <div className="git-history-worktree-danger-list-title">
                  {t("git.revertAllFilesPreviewLabel", { count: revertAllPreviewPaths.length })}
                </div>
                <ul>
                  {revertAllPreviewPaths.map((path) => (
                    <li key={path}>
                      <code className="git-history-worktree-danger-file">{path}</code>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="git-history-worktree-danger-note">
                <span className="git-history-danger-keyword">{t("git.revertAllKeywordIrreversible")}</span>
                <span>{t("git.revertAllBeginnerHint")}</span>
              </div>
            </div>
            <div className="git-history-create-branch-actions">
              <button
                type="button"
                className="git-history-create-branch-btn is-cancel"
                disabled={operationLoading}
                onClick={() => setDiscardAllDialogOpen(false)}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="git-history-create-branch-btn is-danger"
                disabled={operationLoading}
                onClick={() => void handleConfirmDiscardAll()}
              >
                {operationLoading ? t("common.loading") : t("git.revertAllConfirmAction")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {discardDialogPaths ? (
        <div
          className="git-history-create-branch-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !operationLoading) {
              setDiscardDialogPaths(null);
            }
          }}
        >
          <div
            className="git-history-worktree-danger-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={t("git.discardConfirmTitle")}
          >
            <div className="git-history-create-branch-title">{t("git.discardConfirmTitle")}</div>
            <div className="git-history-worktree-danger-copy">
              <p>{t("git.discardDialogBeginnerLead")}</p>
              <div className="git-history-worktree-danger-list">
                <div className="git-history-worktree-danger-list-title">{t("git.discardDialogAffectsLabel")}</div>
                <ul>
                  {discardDialogPaths.map((path) => (
                    <li key={path}>
                      <code className="git-history-worktree-danger-file">{path}</code>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="git-history-worktree-danger-note">
                <span className="git-history-danger-keyword">{t("git.revertAllKeywordIrreversible")}</span>
                <span>{t("git.discardDialogBeginnerHint")}</span>
              </div>
            </div>
            <div className="git-history-create-branch-actions">
              <button
                type="button"
                className="git-history-create-branch-btn is-cancel"
                disabled={operationLoading}
                onClick={() => setDiscardDialogPaths(null)}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="git-history-create-branch-btn is-danger"
                disabled={operationLoading}
                onClick={() => void handleConfirmDiscardFiles()}
              >
                {operationLoading ? t("common.loading") : t("git.discardDialogConfirmAction")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {commitMessageContextMenu ? (
        <RendererContextMenu
          menu={commitMessageContextMenu}
          onClose={() => setCommitMessageContextMenu(null)}
          className="renderer-context-menu git-history-worktree-context-menu"
        />
      ) : null}
    </div>
  );
}
