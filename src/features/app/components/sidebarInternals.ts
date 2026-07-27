import type {
  ConversationItem,
  ThreadSummary,
  WorkspaceInfo,
} from "../../../types";
import {
  getClientStoreSync,
  writeClientStoreValue,
} from "../../../services/clientStorage";
import type { ThreadMoveFolderTarget } from "../hooks/useSidebarMenus";
import {
  extractToolName,
  getFirstStringField,
  parseToolArgs,
} from "../../../utils/toolSemantics";
import type { WorkspaceSessionFolder } from "../../../services/tauri";

export type WorkspaceGroupSection = {
  id: string | null;
  name: string;
  workspaces: WorkspaceInfo[];
};

export type WorkspaceThreadRows = {
  unpinnedRows: Array<{ thread: ThreadSummary; depth: number }>;
  totalRoots: number;
};

type ToolConversationItem = Extract<ConversationItem, { kind: "tool" }>;

export type ThreadFolderMovePickerState = {
  workspaceId: string;
  threadId: string;
  targets: ThreadMoveFolderTarget[];
  currentFolderId: string | null;
};

const SESSION_FOLDER_COLLAPSED_STATE_KEY = "workspaceSessionFolders.collapsedByWorkspaceId";
export const EMPTY_SESSION_FOLDERS: WorkspaceSessionFolder[] = [];
export const EMPTY_SESSION_FOLDER_OVERRIDES: Record<string, string | null | undefined> = {};

export function readPersistedCollapsedSessionFolderIds(): Record<string, string[]> {
  const stored = getClientStoreSync<Record<string, unknown>>(
    "layout",
    SESSION_FOLDER_COLLAPSED_STATE_KEY,
  );
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
    return {};
  }
  const normalized: Record<string, string[]> = {};
  Object.entries(stored).forEach(([workspaceId, rawIds]) => {
    if (!Array.isArray(rawIds)) {
      return;
    }
    const folderIds = rawIds
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean);
    if (folderIds.length > 0) {
      normalized[workspaceId] = Array.from(new Set(folderIds));
    }
  });
  return normalized;
}

export function writePersistedCollapsedSessionFolderIds(value: Record<string, string[]>): void {
  writeClientStoreValue("layout", SESSION_FOLDER_COLLAPSED_STATE_KEY, value);
}

export function updateCollapsedSessionFolderIdsForWorkspace(
  current: Record<string, string[]>,
  workspaceId: string,
  folderIds: string[],
): Record<string, string[]> {
  const normalizedIds = Array.from(new Set(folderIds.map((id) => id.trim()).filter(Boolean)));
  if (normalizedIds.length === 0) {
    const { [workspaceId]: _removed, ...rest } = current;
    return rest;
  }
  return {
    ...current,
    [workspaceId]: normalizedIds,
  };
}

export function isPendingEngineThreadId(threadId: string): boolean {
  const normalizedThreadId = threadId.trim();
  return (
    normalizedThreadId.startsWith("codex-pending-") ||
    normalizedThreadId.startsWith("claude-pending-") ||
    normalizedThreadId.startsWith("gemini-pending-") ||
    normalizedThreadId.startsWith("kimi-pending-") ||
    normalizedThreadId.startsWith("grok-pending-") ||
    normalizedThreadId.startsWith("opencode-pending-")
  );
}

export function isSharedSessionThreadId(threadId: string): boolean {
  return threadId.trim().startsWith("shared:");
}

export function isSessionCatalogNotReadyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes("session does not belong to target workspace") ||
    normalizedMessage.includes("codex session target could not be resolved safely")
  );
}

export function resolveEnginePrefix(threadId: string): "claude" | "gemini" | "kimi" | "grok" | "opencode" | "codex" {
  if (threadId.startsWith("claude:") || threadId.startsWith("claude-pending-")) {
    return "claude";
  }
  if (threadId.startsWith("gemini:") || threadId.startsWith("gemini-pending-")) {
    return "gemini";
  }
  if (threadId.startsWith("kimi:") || threadId.startsWith("kimi-pending-")) {
    return "kimi";
  }
  if (threadId.startsWith("grok:") || threadId.startsWith("grok-pending-")) {
    return "grok";
  }
  if (threadId.startsWith("opencode:") || threadId.startsWith("opencode-pending-")) {
    return "opencode";
  }
  if (threadId.startsWith("codex:") || threadId.startsWith("codex-pending-")) {
    return "codex";
  }
  return "codex";
}

export function resolveFolderIntentReplacementThreadId(
  pendingThreadId: string,
  threads: ThreadSummary[],
): string | null {
  if (!isPendingEngineThreadId(pendingThreadId)) {
    return pendingThreadId;
  }
  const explicitReplacement = threads.find((thread) =>
    thread.nativeThreadIds?.includes(pendingThreadId),
  );
  if (explicitReplacement && !isPendingEngineThreadId(explicitReplacement.id)) {
    return explicitReplacement.id;
  }
  const pendingEngine = resolveEnginePrefix(pendingThreadId);
  const sameEngineRealThreads = threads.filter((thread) => {
    const engineSource = thread.engineSource ?? resolveEnginePrefix(thread.id);
    return (
      engineSource === pendingEngine &&
      thread.id.startsWith(`${pendingEngine}:`) &&
      !thread.id.includes("-pending-")
    );
  });
  if (sameEngineRealThreads.length !== 1) {
    return null;
  }
  return sameEngineRealThreads[0]?.id ?? null;
}

export function isClaudeThreadId(threadId: string | null | undefined) {
  return Boolean(threadId?.startsWith("claude:") || threadId?.startsWith("claude-pending-"));
}

export function isPendingSubagentThreadId(threadId: string) {
  return threadId.startsWith("claude-pending-subagent:");
}

function resolveThreadParentId(
  thread: ThreadSummary,
  threadParentById: Record<string, string>,
) {
  return thread.parentThreadId ?? threadParentById[thread.id] ?? null;
}

export function collectThreadSubtreeIds(
  threads: ThreadSummary[],
  threadParentById: Record<string, string>,
  rootThreadId: string,
) {
  const childrenByParent = new Map<string, string[]>();
  threads.forEach((thread) => {
    const parentId = resolveThreadParentId(thread, threadParentById);
    if (!parentId || parentId === thread.id) {
      return;
    }
    const children = childrenByParent.get(parentId) ?? [];
    children.push(thread.id);
    childrenByParent.set(parentId, children);
  });

  const subtreeIds: string[] = [];
  const visited = new Set<string>();
  const visit = (threadId: string) => {
    if (visited.has(threadId)) {
      return;
    }
    visited.add(threadId);
    subtreeIds.push(threadId);
    (childrenByParent.get(threadId) ?? []).forEach(visit);
  };
  visit(rootThreadId);
  return subtreeIds;
}

function isClaudeAgentTool(item: ToolConversationItem) {
  const normalizedToolType =
    (typeof item.toolType === "string" ? item.toolType : "").trim().toLowerCase();
  const normalizedToolName = extractToolName(item.title).trim().toLowerCase();
  return normalizedToolType === "agent" || normalizedToolName === "agent";
}

function isCompletedToolStatus(status: string | undefined, output: string | undefined) {
  const normalized = status?.trim().toLowerCase() ?? "";
  return Boolean(output) || normalized === "completed" || normalized === "success";
}

/**
 * 从对话 items 中筛出 Claude live subagent 投影唯一关心的 agent tool 条目。
 * Sidebar 用它把 `getProjectedThreads` 的依赖从「每个 token 换引用的 activeItems」
 * 收窄为这份小得多、且流式文本 delta 期间引用稳定的子集，避免每个 token
 * 击穿全部 workspace 的线程树排序。
 */
export function filterClaudeLiveSubagentSourceItems(
  items: ConversationItem[],
): ConversationItem[] {
  return items.filter(
    (item) => item.kind === "tool" && isClaudeAgentTool(item),
  );
}

export function buildClaudeLiveSubagentRows(
  threads: ThreadSummary[],
  workspaceId: string,
  activeWorkspaceId: string | null,
  activeThreadId: string | null,
  activeItems: ConversationItem[],
): ThreadSummary[] {
  if (workspaceId !== activeWorkspaceId || !isClaudeThreadId(activeThreadId)) {
    return threads;
  }
  const parent = threads.find((thread) => thread.id === activeThreadId);
  if (!parent) {
    return threads;
  }
  const threadIds = new Set(threads.map((thread) => thread.id));
  const parentSessionId = activeThreadId?.replace(/^claude:/, "") ?? "";
  let unmatchedRealChildCount = threads.filter(
    (thread) =>
      thread.parentThreadId === activeThreadId ||
      thread.id.startsWith(`claude:subagent:${parentSessionId}:`),
  ).length;
  const pendingRows: ThreadSummary[] = [];

  activeItems.forEach((item) => {
    if (item.kind !== "tool" || !isClaudeAgentTool(item)) {
      return;
    }
    const args = parseToolArgs(item.detail);
    const taskId = getFirstStringField(args, ["task_id", "taskId"]);
    const stableAgentId = getFirstStringField(args, ["agent_id", "agentId"]);
    const childSessionId = stableAgentId
      ? `claude:subagent:${parentSessionId}:${stableAgentId}`
      : "";
    if (childSessionId && threadIds.has(childSessionId)) {
      return;
    }
    const output = typeof item.output === "string" ? item.output : "";
    if (!stableAgentId && isCompletedToolStatus(item.status, output) && unmatchedRealChildCount > 0) {
      unmatchedRealChildCount -= 1;
      return;
    }
    const pendingId = `claude-pending-subagent:${activeThreadId}:${taskId || item.id}`;
    if (threadIds.has(pendingId)) {
      return;
    }
    const description =
      getFirstStringField(args, ["description", "prompt", "query", "task"]) ||
      output.split(/\r?\n/, 1)[0]?.trim() ||
      "Claude subagent";
    const subagentType =
      getFirstStringField(args, ["subagent_type", "agent", "type", "name"]) || "Agent";
    pendingRows.push({
      id: pendingId,
      name: `${subagentType} ${description}`.trim(),
      updatedAt: parent.updatedAt,
      engineSource: "claude",
      threadKind: "native",
      parentThreadId: activeThreadId,
      isDegraded: true,
      degradedReason: isCompletedToolStatus(item.status, item.output)
        ? "Subagent transcript is still being indexed."
        : "Subagent is running; transcript is not available yet.",
    });
  });

  return pendingRows.length > 0 ? [...threads, ...pendingRows] : threads;
}
