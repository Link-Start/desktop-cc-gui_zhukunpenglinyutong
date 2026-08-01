import type { GitBranchListItem } from "../../../types";
import type { GitRepositoryBranchCoverage } from "../types/gitRepositoryActions";

type RepositoryBranches = {
  repositoryRoot: string;
  displayName: string;
  branches: readonly GitBranchListItem[];
};

export function buildGitBranchCoverage(
  repositoryBranches: readonly RepositoryBranches[],
): GitRepositoryBranchCoverage[] {
  const coverageByName = new Map<string, GitRepositoryBranchCoverage["repositories"]>();
  for (const repository of repositoryBranches) {
    const uniqueNames = new Set(repository.branches.map((branch) => branch.name));
    uniqueNames.forEach((name) => {
      const coveredRepositories = coverageByName.get(name) ?? [];
      coveredRepositories.push({
        repositoryRoot: repository.repositoryRoot,
        displayName: repository.displayName,
      });
      coverageByName.set(name, coveredRepositories);
    });
  }
  return Array.from(coverageByName, ([name, repositories]) => ({ name, repositories }))
    .filter(({ repositories }) => repositories.length >= 2)
    .sort((left, right) => left.name.localeCompare(right.name));
}
