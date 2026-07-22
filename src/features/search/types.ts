export type SearchResultKind =
  | "action"
  | "file"
  | "api"
  | "kanban"
  | "thread"
  | "message"
  | "history"
  | "skill"
  | "command";

export type SearchScope = "active-workspace" | "global";
export type SearchFileHydrationStatus =
  | "idle"
  | "loading"
  | "complete"
  | "partial"
  | "error";
export type SearchApiHydrationStatus =
  | "idle"
  | "loading"
  | "refreshing"
  | "complete"
  | "error";
export type WorkspaceSearchApiSnapshot = {
  endpoints: import("../project-map/types").ProjectMapApiEndpoint[];
  status: Exclude<SearchApiHydrationStatus, "idle">;
  error: string | null;
};
export type WorkspaceSearchFileSnapshot = {
  files: string[];
  status: "shallow" | Exclude<SearchFileHydrationStatus, "idle">;
  sourceVersion: string | null;
  error: string | null;
};
export type SearchContentFilter =
  | "all"
  | "actions"
  | "files"
  | "apis"
  | "kanban"
  | "threads"
  | "messages"
  | "history"
  | "skills"
  | "commands";

export type SearchResult = {
  id: string;
  kind: SearchResultKind;
  title: string;
  subtitle?: string;
  score: number;
  workspaceId?: string;
  workspaceName?: string;
  threadId?: string;
  messageId?: string;
  panelId?: string;
  taskId?: string;
  filePath?: string;
  fileLine?: number;
  fileColumn?: number;
  historyText?: string;
  actionId?: string;
  skillName?: string;
  commandName?: string;
  apiEndpointId?: string;
  sourceKind?:
    | "actions"
    | "files"
    | "apis"
    | "kanban"
    | "threads"
    | "messages"
    | "history"
    | "skills"
    | "commands";
  locationLabel?: string;
  updatedAt?: number;
};
