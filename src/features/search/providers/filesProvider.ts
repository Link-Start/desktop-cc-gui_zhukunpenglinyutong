import type { SearchResult } from "../types";
import { readSharedWorkspaceFileIndex } from "../../workspaces/utils/sharedWorkspaceFileIndex";

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
    const lower = path.toLowerCase();
    const index = lower.indexOf(normalizedQuery);
    if (index < 0) {
      continue;
    }
    results.push({
      id: `file:${workspaceId}:${path}`,
      kind: "file",
      title: fileNameFromPath(path),
      subtitle: "File",
      score: index === 0 ? 20 : 200 + index,
      workspaceId,
      filePath: path,
      sourceKind: "files",
      locationLabel: path,
    });
  }
  return results;
}
