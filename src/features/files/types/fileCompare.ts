export const FILE_COMPARE_MAX_WORKSPACE_FILES = 4;

export type WorkspaceFileCompareSession = {
  kind: "workspace";
  workspaceId: string;
  paths: string[];
};

export type ScratchFileCompareSession = {
  kind: "scratch";
  requestId: number;
};

export type FileCompareSession =
  | WorkspaceFileCompareSession
  | ScratchFileCompareSession;
