import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  GitBranchListItem,
  GitHistoryCommit,
} from "../../../../../types";
import type { GitHistoryCommitFiltersProps } from "../components/GitHistoryCommitFilters";
import type { GitHistoryPanelPersistedState } from "../components/GitHistoryPanelTypes";
import type { GitHistoryInlinePickerOption } from "../components/GitHistoryPanelPickers";
import {
  resolveGitHistoryDateRange,
  sanitizeGitHistoryDatePreset,
  type GitHistoryCommitFilterValues,
} from "../utils/gitHistoryCommitFilters";

type UseGitHistoryCommitFiltersOptions = {
  workspaceId: string | null;
  selectedRepositoryRoot: string | null;
  persistedPanelState: GitHistoryPanelPersistedState;
  currentBranch: string | null;
  localBranches: GitBranchListItem[];
  remoteBranches: GitBranchListItem[];
  commits: GitHistoryCommit[];
};

export type GitHistoryRequestFilters = {
  branch: string;
  query: string | null;
  author: string | null;
  dateFrom: number | null;
  dateTo: number | null;
  repositoryRoot?: string;
};

export function useGitHistoryCommitFilters({
  workspaceId,
  selectedRepositoryRoot,
  persistedPanelState,
  currentBranch,
  localBranches,
  remoteBranches,
  commits,
}: UseGitHistoryCommitFiltersOptions) {
  const { t } = useTranslation();
  const [selectedBranch, setSelectedBranch] = useState(
    () => persistedPanelState.selectedBranch ?? "all",
  );
  const [commitQuery, setCommitQuery] = useState(
    () => persistedPanelState.commitQuery ?? "",
  );
  const [commitAuthor, setCommitAuthor] = useState(
    () => persistedPanelState.commitAuthor ?? "",
  );
  const [commitDatePreset, setCommitDatePreset] = useState(
    () => sanitizeGitHistoryDatePreset(persistedPanelState.commitDatePreset),
  );

  useEffect(() => {
    setSelectedBranch(persistedPanelState.selectedBranch ?? "all");
    setCommitQuery(persistedPanelState.commitQuery ?? "");
    setCommitAuthor(persistedPanelState.commitAuthor ?? "");
    setCommitDatePreset(
      sanitizeGitHistoryDatePreset(persistedPanelState.commitDatePreset),
    );
  }, [
    persistedPanelState.commitAuthor,
    persistedPanelState.commitDatePreset,
    persistedPanelState.commitQuery,
    persistedPanelState.selectedBranch,
    workspaceId,
  ]);

  const createHistoryRequestFilters = useCallback(
    (): GitHistoryRequestFilters => {
      const commitDateRange = resolveGitHistoryDateRange(commitDatePreset);
      return {
        branch: selectedBranch === "all" ? "all" : selectedBranch,
        query: commitQuery.trim() || null,
        author: commitAuthor.trim() || null,
        dateFrom: commitDateRange.dateFrom,
        dateTo: commitDateRange.dateTo,
        ...(selectedRepositoryRoot === null
          ? {}
          : { repositoryRoot: selectedRepositoryRoot }),
      };
    },
    [
      commitAuthor,
      commitDatePreset,
      commitQuery,
      selectedBranch,
      selectedRepositoryRoot,
    ],
  );

  const branchOptions = useMemo<GitHistoryInlinePickerOption[]>(() => {
    const options: GitHistoryInlinePickerOption[] = [
      { value: "all", label: t("git.historyAllBranches") },
    ];
    const seen = new Set(["all"]);
    const appendBranch = (entry: GitBranchListItem, group: string) => {
      if (seen.has(entry.name)) {
        return;
      }
      seen.add(entry.name);
      options.push({
        value: entry.name,
        label: entry.name,
        description: entry.name === currentBranch ? "HEAD" : undefined,
        group,
      });
    };

    for (const entry of [...localBranches].sort((left, right) =>
      left.name.localeCompare(right.name))) {
      appendBranch(entry, t("git.historyLocal"));
    }
    if (currentBranch && !seen.has(currentBranch)) {
      seen.add(currentBranch);
      options.push({
        value: currentBranch,
        label: currentBranch,
        description: "HEAD",
        group: t("git.historyLocal"),
      });
    }
    for (const entry of [...remoteBranches].sort((left, right) =>
      left.name.localeCompare(right.name))) {
      appendBranch(entry, t("git.historyRemote"));
    }
    return options;
  }, [currentBranch, localBranches, remoteBranches, t]);

  const authorSuggestions = useMemo(() => {
    const suggestions = new Set<string>();
    for (const commit of commits) {
      if (commit.author.trim()) {
        suggestions.add(commit.author.trim());
      }
      if (commit.authorEmail.trim()) {
        suggestions.add(commit.authorEmail.trim());
      }
    }
    return Array.from(suggestions).sort((left, right) => left.localeCompare(right));
  }, [commits]);

  const values = useMemo<GitHistoryCommitFilterValues>(
    () => ({
      query: commitQuery,
      author: commitAuthor,
      datePreset: commitDatePreset,
    }),
    [commitAuthor, commitDatePreset, commitQuery],
  );
  const handleFiltersChange = useCallback(
    (nextFilters: GitHistoryCommitFilterValues) => {
      setCommitQuery(nextFilters.query);
      setCommitAuthor(nextFilters.author);
      setCommitDatePreset(sanitizeGitHistoryDatePreset(nextFilters.datePreset));
    },
    [],
  );
  const handleClear = useCallback(() => {
    setCommitQuery("");
    setCommitAuthor("");
    setCommitDatePreset("all");
    setSelectedBranch(currentBranch ?? "all");
  }, [currentBranch]);
  const commitFilterSurface = useMemo<
    Omit<GitHistoryCommitFiltersProps, "headerTitle">
  >(
    () => ({
      draftScopeKey: workspaceId ?? "",
      values,
      selectedBranch,
      currentBranch,
      branchOptions,
      authorSuggestions,
      disabled: !workspaceId,
      onFiltersChange: handleFiltersChange,
      onBranchChange: setSelectedBranch,
      onClear: handleClear,
    }),
    [
      authorSuggestions,
      branchOptions,
      currentBranch,
      handleClear,
      handleFiltersChange,
      selectedBranch,
      values,
      workspaceId,
    ],
  );

  return {
    selectedBranch,
    setSelectedBranch,
    commitQuery,
    commitAuthor,
    commitDatePreset,
    createHistoryRequestFilters,
    commitFilterSurface,
  };
}
