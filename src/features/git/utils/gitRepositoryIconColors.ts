import type { GitRepositorySummary } from "../../../types";

export const GIT_REPOSITORY_ICON_COLOR_CLASSES = [
  "text-blue-600 dark:text-blue-400", "text-emerald-600 dark:text-emerald-400",
  "text-orange-600 dark:text-orange-400", "text-violet-600 dark:text-violet-400",
  "text-pink-600 dark:text-pink-400", "text-cyan-600 dark:text-cyan-400",
  "text-amber-600 dark:text-amber-400", "text-lime-600 dark:text-lime-400",
  "text-indigo-600 dark:text-indigo-400", "text-rose-600 dark:text-rose-400",
  "text-teal-600 dark:text-teal-400", "text-purple-600 dark:text-purple-400",
  "text-sky-600 dark:text-sky-400", "text-fuchsia-600 dark:text-fuchsia-400",
  "text-red-600 dark:text-red-400", "text-green-600 dark:text-green-400",
] as const;

export const GIT_REPOSITORY_SWATCH_COLOR_CLASSES = [
  "bg-blue-500", "bg-emerald-500", "bg-orange-500", "bg-violet-500",
  "bg-pink-500", "bg-cyan-500", "bg-amber-500", "bg-lime-500",
  "bg-indigo-500", "bg-rose-500", "bg-teal-500", "bg-purple-500",
  "bg-sky-500", "bg-fuchsia-500", "bg-red-500", "bg-green-500",
] as const;

const REPOSITORY_COLOR_HASH_OFFSET = 0x811c9dc5;
const REPOSITORY_COLOR_HASH_PRIME = 0x01000193;

export function compareGitIdentity(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function getRepositoryColorHash(repositoryRoot: string): number {
  let repositoryHash = REPOSITORY_COLOR_HASH_OFFSET;
  for (let index = 0; index < repositoryRoot.length; index += 1) {
    repositoryHash ^= repositoryRoot.charCodeAt(index);
    repositoryHash = Math.imul(repositoryHash, REPOSITORY_COLOR_HASH_PRIME);
  }
  return repositoryHash >>> 0;
}

export function buildGitRepositoryIconColorSlots(
  repositories: readonly GitRepositorySummary[],
): Map<string, number> {
  const colorSlots = new Map<string, number>();
  const usedColorSlots = new Set<number>();
  const sortedRepositoryRoots = repositories
    .map(({ repositoryRoot }) => repositoryRoot)
    .sort(compareGitIdentity);

  sortedRepositoryRoots.forEach((repositoryRoot) => {
    let colorSlot = getRepositoryColorHash(repositoryRoot)
      % GIT_REPOSITORY_ICON_COLOR_CLASSES.length;
    while (
      usedColorSlots.size < GIT_REPOSITORY_ICON_COLOR_CLASSES.length
      && usedColorSlots.has(colorSlot)
    ) {
      colorSlot = (colorSlot + 1) % GIT_REPOSITORY_ICON_COLOR_CLASSES.length;
    }
    usedColorSlots.add(colorSlot);
    colorSlots.set(repositoryRoot, colorSlot);
  });
  return colorSlots;
}
