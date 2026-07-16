import type { GitBlameHunk, GitFileBlameResponse } from "../../../types";
import { normalizeFsPath } from "../../../utils/workspacePaths";

export const FILE_GIT_BLAME_MAX_BYTES = 2 * 1024 * 1024;
export const FILE_GIT_BLAME_MAX_LINES = 50_000;

export function resolveGitBlameRepositoryPath(
  workspaceRelativePath: string,
  repositoryRoot: string | null,
) {
  const normalizedPath = normalizeFsPath(workspaceRelativePath).replace(/^\.\/+/, "");
  const normalizedRoot = normalizeFsPath(repositoryRoot ?? "")
    .replace(/^\.\/+/, "")
    .replace(/\/+$/, "");
  if (!normalizedRoot) {
    return normalizedPath;
  }
  if (normalizedPath === normalizedRoot) {
    return "";
  }
  return normalizedPath.startsWith(`${normalizedRoot}/`)
    ? normalizedPath.slice(normalizedRoot.length + 1)
    : normalizedPath;
}

export function normalizeGitBlameResponse(
  response: GitFileBlameResponse,
): GitFileBlameResponse {
  const candidates = response.hunks
    .filter(
      (hunk) =>
        Number.isInteger(hunk.startLine) &&
        hunk.startLine > 0 &&
        Number.isInteger(hunk.lineCount) &&
        hunk.lineCount > 0 &&
        hunk.startLine <= response.lineCount,
    )
    .toSorted((left, right) => left.startLine - right.startLine);
  const hunks: GitBlameHunk[] = [];
  let previousEndLine = 0;
  for (const hunk of candidates) {
    if (hunk.startLine <= previousEndLine) {
      continue;
    }
    const lineCount = Math.min(hunk.lineCount, response.lineCount - hunk.startLine + 1);
    hunks.push(lineCount === hunk.lineCount ? hunk : { ...hunk, lineCount });
    previousEndLine = hunk.startLine + lineCount - 1;
  }
  return { ...response, hunks };
}

export function findGitBlameHunk(
  hunks: readonly GitBlameHunk[],
  lineNumber: number,
): GitBlameHunk | null {
  let low = 0;
  let high = hunks.length - 1;
  while (low <= high) {
    const middle = low + Math.floor((high - low) / 2);
    const hunk = hunks[middle];
    if (!hunk) {
      return null;
    }
    if (lineNumber < hunk.startLine) {
      high = middle - 1;
      continue;
    }
    if (lineNumber >= hunk.startLine + hunk.lineCount) {
      low = middle + 1;
      continue;
    }
    return hunk;
  }
  return null;
}

export function formatGitBlameDate(authoredAt: number) {
  if (authoredAt <= 0) {
    return "—";
  }
  return new Date(authoredAt * 1000).toISOString().slice(0, 10);
}

export function formatGitBlameCompact(hunk: GitBlameHunk) {
  return `${formatGitBlameDate(hunk.authoredAt)} ${hunk.author}`;
}

export function formatGitBlameDetails(hunk: GitBlameHunk) {
  const revision = hunk.commitSha ? hunk.commitSha.slice(0, 8) : "uncommitted";
  const authoredAt =
    hunk.authoredAt > 0 ? new Date(hunk.authoredAt * 1000).toLocaleString() : "Uncommitted";
  return `${hunk.author}, ${authoredAt} · ${revision} · ${hunk.summary}`;
}
