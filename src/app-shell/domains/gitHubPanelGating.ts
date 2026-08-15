/**
 * S4 PR-B：GitHub 面板数据加载门控纯 selector（无 UI，可单测），归 gitSurface 域。
 *
 * 从根 composition 收编：issues / prs 面板或 PR diff 需要拉取 GitHub 数据。
 */

export type GitPanelMode = "diff" | "log" | "issues" | "prs";
export type GitDiffSource = "local" | "pr" | "commit";

export type ResolveShouldLoadGitHubPanelDataOptions = {
  gitPanelMode: GitPanelMode;
  shouldLoadDiffs: boolean;
  diffSource: GitDiffSource;
};

export function resolveShouldLoadGitHubPanelData({
  gitPanelMode,
  shouldLoadDiffs,
  diffSource,
}: ResolveShouldLoadGitHubPanelDataOptions): boolean {
  return (
    gitPanelMode === "issues" ||
    gitPanelMode === "prs" ||
    (shouldLoadDiffs && diffSource === "pr")
  );
}
