import {
  memo,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type MouseEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { TFunction } from "i18next";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import Cloud from "lucide-react/dist/esm/icons/cloud";
import Folder from "lucide-react/dist/esm/icons/folder";
import FolderOpen from "lucide-react/dist/esm/icons/folder-open";
import GitBranch from "lucide-react/dist/esm/icons/git-branch";
import HardDrive from "lucide-react/dist/esm/icons/hard-drive";
import LoaderCircle from "lucide-react/dist/esm/icons/loader-circle";
import type { GitBranchListItem, GitRepositorySummary } from "../../../../../types";
import {
  buildGitRepositoryIconColorSlots,
  compareGitIdentity,
  GIT_REPOSITORY_SWATCH_COLOR_CLASSES,
} from "../../../../git/utils/gitRepositoryIconColors";
import type { GitHistoryRepositoryBranchCatalog } from "../hooks/useGitHistoryRepositoryBranchCatalogs";
import {
  getBranchLeafName,
  getBranchScope,
  getSpecialBranchBadges,
} from "../utils/gitHistoryPanelSharedUtils";
import { ActionSurface } from "./GitHistoryPanelPickers";

type BranchScope = "local" | "remote";

type BranchGroup = {
  key: string;
  label: string;
  branches: readonly GitBranchListItem[];
};

type GitHistoryMultiRepositoryBranchTreeProps = {
  repositories: readonly GitRepositorySummary[];
  catalogs: ReadonlyMap<string, GitHistoryRepositoryBranchCatalog>;
  selectedRepositoryRoot: string | null;
  selectedBranch: string;
  query: string;
  t: TFunction;
  onSelectBranch: (repositoryRoot: string, branchName: string) => void;
  onOpenBranchContextMenu?: (
    event: MouseEvent<HTMLDivElement>,
    repositoryRoot: string,
    branch: GitBranchListItem,
    scope: BranchScope,
  ) => void;
};

function filterBranches(
  repository: GitRepositorySummary,
  branches: readonly GitBranchListItem[],
  query: string,
) {
  if (!query || repository.displayName.toLowerCase().includes(query)) {
    return branches;
  }
  return branches.filter((branch) => branch.name.toLowerCase().includes(query));
}

function getRemoteBranchLabel(branch: GitBranchListItem) {
  const prefix = branch.remote ? `${branch.remote}/` : "";
  return prefix && branch.name.startsWith(prefix) ? branch.name.slice(prefix.length) : branch.name;
}

function buildBranchGroups(
  scope: BranchScope,
  branches: readonly GitBranchListItem[],
  t: TFunction,
): BranchGroup[] {
  const groups = new Map<string, GitBranchListItem[]>();
  for (const branch of branches) {
    const key = scope === "local"
      ? getBranchScope(branch.name)
      : branch.remote?.trim() || "__remote__";
    const groupedBranches = groups.get(key);
    if (groupedBranches) groupedBranches.push(branch); else groups.set(key, [branch]);
  }
  return Array.from(groups.entries())
    .sort(([left], [right]) => {
      if (left === "__root__") return -1;
      if (right === "__root__") return 1;
      return compareGitIdentity(left, right);
    })
    .map(([key, groupedBranches]) => ({
      key,
      label: key === "__root__"
        ? t("git.historyRootGroup")
        : key === "__remote__"
          ? t("git.historyRemote")
          : key,
      branches: groupedBranches.slice().sort((left, right) => (
        compareGitIdentity(left.name, right.name)
      )),
    }));
}

function getBranchGroupIdentity(scope: BranchScope, repositoryRoot: string, groupKey: string) {
  return `${scope}\0${repositoryRoot}\0${groupKey}`;
}

export const GitHistoryMultiRepositoryBranchTree = memo(function GitHistoryMultiRepositoryBranchTree({
  repositories,
  catalogs,
  selectedRepositoryRoot,
  selectedBranch,
  query,
  t,
  onSelectBranch,
  onOpenBranchContextMenu,
}: GitHistoryMultiRepositoryBranchTreeProps) {
  const activeRepositoryRoot = selectedRepositoryRoot
    ?? (repositories.length === 1 ? repositories[0]?.repositoryRoot ?? null : null);
  const [expandedSections, setExpandedSections] = useState<Set<BranchScope>>(
    () => new Set(["local", "remote"]),
  );
  const [expandedLocalRepositories, setExpandedLocalRepositories] = useState<Set<string>>(
    () => new Set(activeRepositoryRoot === null ? [] : [activeRepositoryRoot]),
  );
  const [expandedRemoteRepositories, setExpandedRemoteRepositories] = useState<Set<string>>(
    () => new Set(activeRepositoryRoot === null ? [] : [activeRepositoryRoot]),
  );
  const [expandedBranchGroups, setExpandedBranchGroups] = useState<Set<string>>(() => new Set());
  const colorSlots = useMemo(() => buildGitRepositoryIconColorSlots(repositories), [repositories]);
  const normalizedQuery = query.trim().toLowerCase();

  useEffect(() => {
    if (activeRepositoryRoot === null) {
      return;
    }
    setExpandedLocalRepositories((previous) => {
      if (previous.has(activeRepositoryRoot)) return previous;
      return new Set(previous).add(activeRepositoryRoot);
    });
    setExpandedRemoteRepositories((previous) => {
      if (previous.has(activeRepositoryRoot)) return previous;
      return new Set(previous).add(activeRepositoryRoot);
    });
  }, [activeRepositoryRoot]);

  useEffect(() => {
    setExpandedBranchGroups((previous) => {
      let next = previous;
      for (const repository of repositories) {
        const catalog = catalogs.get(repository.repositoryRoot);
        if (catalog?.localBranches.some((branch) => getBranchScope(branch.name) === "__root__")) {
          const rootIdentity = getBranchGroupIdentity(
            "local",
            repository.repositoryRoot,
            "__root__",
          );
          if (!next.has(rootIdentity)) {
            if (next === previous) next = new Set(previous);
            next.add(rootIdentity);
          }
        }
        const currentLocalBranch = catalog?.localBranches.find((branch) => branch.isCurrent)
          ?? catalog?.localBranches.find((branch) => branch.name === catalog.currentBranch);
        if (!currentLocalBranch) continue;
        const identity = getBranchGroupIdentity(
          "local",
          repository.repositoryRoot,
          getBranchScope(currentLocalBranch.name),
        );
        if (!next.has(identity)) {
          if (next === previous) next = new Set(previous);
          next.add(identity);
        }
      }
      return next;
    });
  }, [catalogs, repositories]);

  const toggleSetValue = (
    setter: Dispatch<SetStateAction<Set<string>>>,
    value: string,
  ) => {
    setter((previous) => {
      const next = new Set(previous);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  };

  const selectedRepository = repositories.find(
    (repository) => repository.repositoryRoot === activeRepositoryRoot,
  );
  const selectedCatalog = activeRepositoryRoot === null
    ? null
    : catalogs.get(activeRepositoryRoot);
  const currentBranch = selectedCatalog?.currentBranch ?? selectedRepository?.currentBranch ?? null;

  const renderRepositorySection = (
    scope: BranchScope,
    icon: ReactNode,
    label: string,
  ) => {
    const sectionExpanded = normalizedQuery.length > 0 || expandedSections.has(scope);
    const expandedRepositories = scope === "local"
      ? expandedLocalRepositories
      : expandedRemoteRepositories;
    const setExpandedRepositories = scope === "local"
      ? setExpandedLocalRepositories
      : setExpandedRemoteRepositories;

    const repositoryRows = repositories.flatMap((repository) => {
      const catalog = catalogs.get(repository.repositoryRoot);
      const sourceBranches = scope === "local"
        ? catalog?.localBranches ?? []
        : catalog?.remoteBranches ?? [];
      const visibleBranches = filterBranches(repository, sourceBranches, normalizedQuery);
      const branchGroups = buildBranchGroups(scope, visibleBranches, t);
      const repositoryMatches = repository.displayName.toLowerCase().includes(normalizedQuery);
      if (normalizedQuery && !repositoryMatches && visibleBranches.length === 0) {
        return [];
      }
      const repositoryExpanded = normalizedQuery.length > 0
        ? true
        : expandedRepositories.has(repository.repositoryRoot);
      const colorSlot = colorSlots.get(repository.repositoryRoot) ?? 0;
      return [(
        <div
          key={`${scope}-${repository.repositoryRoot}`}
          className="git-history-multi-repository-group"
        >
          <ActionSurface
            className="git-history-multi-repository-row"
            active={activeRepositoryRoot === repository.repositoryRoot}
            onActivate={() => toggleSetValue(setExpandedRepositories, repository.repositoryRoot)}
            ariaLabel={t("git.historyToggleRepositoryBranches", {
              repository: repository.displayName,
              scope: label,
            })}
          >
            {repositoryExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <span
              className={`git-history-repository-swatch ${GIT_REPOSITORY_SWATCH_COLOR_CLASSES[colorSlot]}`}
              aria-hidden
            />
            <span className="git-history-multi-repository-name">{repository.displayName}</span>
          </ActionSurface>
          {repositoryExpanded ? (
            <div className="git-history-multi-repository-branches">
              {catalog?.status === "loading" || !catalog ? (
                <span className="git-history-multi-repository-state">
                  <LoaderCircle size={11} className="spin" />
                  {t("git.historyRepositoryBranchesLoading")}
                </span>
              ) : catalog.status === "error" ? (
                <span className="git-history-multi-repository-state is-error" title={catalog.error ?? undefined}>
                  {t("git.historyRepositoryBranchesLoadFailed")}
                </span>
              ) : visibleBranches.length === 0 ? (
                <span className="git-history-multi-repository-state">
                  {t(scope === "local"
                    ? "git.historyRepositoryNoLocalBranches"
                    : "git.historyRepositoryNoRemoteBranches")}
                </span>
              ) : branchGroups.map((group) => {
                const groupIdentity = getBranchGroupIdentity(
                  scope,
                  repository.repositoryRoot,
                  group.key,
                );
                const groupExpanded = normalizedQuery.length > 0
                  || expandedBranchGroups.has(groupIdentity);
                return (
                  <div key={groupIdentity} className="git-history-tree-scope-group">
                    <ActionSurface
                      className="git-history-tree-scope-toggle"
                      onActivate={() => toggleSetValue(setExpandedBranchGroups, groupIdentity)}
                      ariaLabel={t(scope === "local"
                        ? "git.historyToggleLocalGroup"
                        : "git.historyToggleRemoteGroup", { group: group.label })}
                    >
                      {groupExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      {groupExpanded ? <FolderOpen size={12} /> : <Folder size={12} />}
                      <span className="git-history-tree-scope-label">{group.label}</span>
                    </ActionSurface>
                    {groupExpanded ? (
                      <div className="git-history-multi-branch-group-body">
                        {group.branches.map((branch) => (
                          <ActionSurface
                            key={`${scope}-${repository.repositoryRoot}-${branch.name}`}
                            className={`git-history-branch-item git-history-multi-repository-branch ${
                              scope === "local"
                                ? "git-history-branch-item-tree"
                                : "git-history-branch-item-remote-tree"
                            } ${scope === "local" && branch.isCurrent ? "is-head-branch" : ""}`}
                            active={activeRepositoryRoot === repository.repositoryRoot && selectedBranch === branch.name}
                            onActivate={() => onSelectBranch(repository.repositoryRoot, branch.name)}
                            onContextMenu={(event) => onOpenBranchContextMenu?.(
                              event,
                              repository.repositoryRoot,
                              branch,
                              scope,
                            )}
                          >
                            <span className="git-history-tree-branch-main">
                              <GitBranch size={11} />
                              <span className="git-history-branch-name">
                                {scope === "remote"
                                  ? getRemoteBranchLabel(branch)
                                  : getBranchLeafName(branch.name)}
                              </span>
                            </span>
                            <span className="git-history-branch-badges">
                              {scope === "local" && branch.isCurrent
                                ? <em className="is-head">HEAD</em>
                                : null}
                              {getSpecialBranchBadges(branch.name, t).map((badge) => (
                                <i key={`${branch.name}-${badge}`} className="is-special">
                                  {badge}
                                </i>
                              ))}
                              {scope === "local" && branch.ahead > 0
                                ? <i className="is-ahead">+{branch.ahead}</i>
                                : null}
                              {scope === "local" && branch.behind > 0
                                ? <i className="is-behind">-{branch.behind}</i>
                                : null}
                            </span>
                          </ActionSurface>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      )];
    });

    return (
      <div className="git-history-tree-section git-history-multi-repository-section">
        <ActionSurface
          className="git-history-tree-section-toggle"
          onActivate={() => setExpandedSections((previous) => {
            const next = new Set(previous);
            if (next.has(scope)) next.delete(scope); else next.add(scope);
            return next;
          })}
          ariaLabel={scope === "local"
            ? t("git.historyToggleLocalBranches")
            : t("git.historyToggleRemoteBranches")}
        >
          {sectionExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          {icon}
          <span>{label}</span>
        </ActionSurface>
        {sectionExpanded ? (
          <div className="git-history-tree-section-body">{repositoryRows}</div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="git-history-multi-repository-tree">
      <ActionSurface
        className="git-history-multi-head"
        active={Boolean(currentBranch) && selectedBranch === currentBranch}
        disabled={!currentBranch || activeRepositoryRoot === null}
        onActivate={() => {
          if (currentBranch && activeRepositoryRoot !== null) {
            onSelectBranch(activeRepositoryRoot, currentBranch);
          }
        }}
      >
        <span>HEAD</span>
        <span className="git-history-multi-head-label">({t("git.historyCurrentBranch")})</span>
        {currentBranch ? <code>{currentBranch}</code> : null}
      </ActionSurface>
      <ActionSurface
        className="git-history-branch-item git-history-branch-all-item"
        active={selectedBranch === "all"}
        disabled={activeRepositoryRoot === null}
        onActivate={() => {
          if (activeRepositoryRoot !== null) {
            onSelectBranch(activeRepositoryRoot, "all");
          }
        }}
      >
        <span>{t("git.historyAllBranches")}</span>
      </ActionSurface>
      {renderRepositorySection("local", <HardDrive size={13} />, t("git.historyLocal"))}
      {renderRepositorySection("remote", <Cloud size={13} />, t("git.historyRemote"))}
    </div>
  );
});
