import type { GitRepositorySummary } from "../../../types";

export type FileGitScope = {
  repositoryRoot: string;
  path: string;
};

function normalizeRelativePath(path: string): string | null {
  const trimmed = path.trim();
  if (
    !trimmed ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("\\") ||
    /^[A-Za-z]:/.test(trimmed)
  ) {
    return null;
  }
  const normalized = trimmed.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/$/, "");
  if (!normalized || normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
    return null;
  }
  return normalized;
}

export function resolveFileGitScope(
  workspaceRelativePath: string,
  repositories: GitRepositorySummary[],
): FileGitScope | null {
  const path = normalizeRelativePath(workspaceRelativePath);
  if (!path) return null;

  const repositoryRoot = repositories
    .map((repository) => normalizeRelativePath(repository.repositoryRoot) ?? "")
    .filter((root) => root === "" || path === root || path.startsWith(`${root}/`))
    .sort((left, right) => right.length - left.length)[0];
  if (repositoryRoot === undefined || path === repositoryRoot) return null;

  return {
    repositoryRoot,
    path: repositoryRoot ? path.slice(repositoryRoot.length + 1) : path,
  };
}
