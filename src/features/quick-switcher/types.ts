export const QUICK_SWITCHER_RECENT_LIMIT = 30;

export type QuickSwitcherRecentFileSource = "opened" | "ai-modified";

export type QuickSwitcherRecentFile = {
  workspaceId: string;
  path: string;
  touchedAt: number;
  source: QuickSwitcherRecentFileSource;
  aiModifiedAt?: number;
};

export type QuickSwitcherNavigationId =
  | "chat"
  | "files"
  | "git"
  | "history"
  | "kanban"
  | "spec"
  | "intentCanvas"
  | "projectMap"
  | "terminal"
  | "settings";

export type QuickSwitcherSession = {
  workspaceId: string;
  id: string;
  title: string;
  updatedAt: number;
  engine: "codex" | "claude" | "gemini" | "kimi" | "opencode";
  isShared: boolean;
};

export type QuickSwitcherSessionGroup = {
  workspaceId: string;
  workspaceName: string;
  latestAt: number;
  sessions: QuickSwitcherSession[];
};

export type QuickSwitcherRecentFileGroup = {
  workspaceId: string;
  workspaceName: string;
  latestAt: number;
  files: QuickSwitcherRecentFile[];
};
