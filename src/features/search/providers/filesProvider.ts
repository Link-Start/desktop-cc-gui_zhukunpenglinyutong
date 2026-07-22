import type { SearchResult } from "../types";
import { readSharedWorkspaceFileIndex } from "../../workspaces/utils/sharedWorkspaceFileIndex";
import { bestFuzzyMatchScore } from "../ranking/fuzzy";

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

export function searchFiles(
  query: string,
  files: string[],
  workspaceId: string,
  sourceVersion?: string | null,
): SearchResult[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }
  const results: SearchResult[] = [];
  const sharedIndex = readSharedWorkspaceFileIndex({ workspaceId, sourceVersion });
  const candidateFiles = sharedIndex && sharedIndex.freshness !== "stale"
    ? sharedIndex.files.map((entry) => entry.path)
    : files;
  for (const path of candidateFiles) {
    const title = fileNameFromPath(path);
    const matchScore = bestFuzzyMatchScore(normalizedQuery, [title, path]);
    if (matchScore === null) {
      continue;
    }
    results.push({
      id: `file:${workspaceId}:${path}`,
      kind: "file",
      title,
      subtitle: "File",
      score: matchScore,
      workspaceId,
      filePath: path,
      sourceKind: "files",
      locationLabel: path,
    });
  }
  return results;
}
