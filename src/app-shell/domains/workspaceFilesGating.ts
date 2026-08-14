/**
 * S4 PR-B：workspace 文件树加载门控纯 selector（无 UI，可单测），归 workspaceCatalog 域。
 *
 * 从根 composition 收编：initial load 需有 active workspace；polling 仅在
 * 非 compact、右面板展开且 filePanelMode === "files" 时开启。
 */

export type WorkspaceFilePanelMode =
  | "git"
  | "files"
  | "search"
  | "notes"
  | "prompts"
  | "memory"
  | "activity"
  | "radar";

export type ResolveWorkspaceFilesLoadFlagsOptions = {
  activeWorkspaceId: string | null | undefined;
  isCompact: boolean;
  rightPanelCollapsed: boolean;
  filePanelMode: WorkspaceFilePanelMode;
};

export type WorkspaceFilesLoadFlags = {
  initialLoadEnabled: boolean;
  pollingEnabled: boolean;
};

export function resolveWorkspaceFilesLoadFlags({
  activeWorkspaceId,
  isCompact,
  rightPanelCollapsed,
  filePanelMode,
}: ResolveWorkspaceFilesLoadFlagsOptions): WorkspaceFilesLoadFlags {
  return {
    initialLoadEnabled: Boolean(activeWorkspaceId),
    pollingEnabled:
      !isCompact && !rightPanelCollapsed && filePanelMode === "files",
  };
}
