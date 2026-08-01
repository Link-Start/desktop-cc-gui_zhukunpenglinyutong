export type FileHistoryTarget = {
  workspaceId: string;
  workspacePath: string;
  repositoryRoot: string;
  path: string;
  displayPath: string;
};

export const GIT_GRAPH_TAB_ID = "git-graph";

export function getFileHistoryTabId(target: FileHistoryTarget): string {
  return JSON.stringify([target.workspaceId, target.repositoryRoot, target.path]);
}
