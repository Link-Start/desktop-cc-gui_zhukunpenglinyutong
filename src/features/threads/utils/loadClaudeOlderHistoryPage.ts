import type { ConversationItem } from "../../../types";
import { loadClaudeSession } from "../../../services/tauri/session";
import {
  CLAUDE_UI_HISTORY_WINDOW,
  parseClaudeHistoryMessagesWithShadowRecovery,
} from "../loaders/claudeHistoryLoader";

export type LoadClaudeOlderHistoryPageInput = {
  threadId: string;
  workspaceId: string;
  workspacePath: string;
  before: string;
  limit?: number;
  loadClaudeSessionFn?: typeof loadClaudeSession;
  parseMessagesFn?: typeof parseClaudeHistoryMessagesWithShadowRecovery;
};

export type LoadClaudeOlderHistoryPageResult = {
  items: ConversationItem[];
  hasMore: boolean;
  nextCursor: string | null;
};

function resolveClaudeSessionId(threadId: string): string {
  return threadId.startsWith("claude:")
    ? threadId.slice("claude:".length)
    : threadId;
}

export async function loadClaudeOlderHistoryPage(
  input: LoadClaudeOlderHistoryPageInput,
): Promise<LoadClaudeOlderHistoryPageResult> {
  const sessionId = resolveClaudeSessionId(input.threadId);
  const loadFn = input.loadClaudeSessionFn ?? loadClaudeSession;
  const parseFn =
    input.parseMessagesFn ?? parseClaudeHistoryMessagesWithShadowRecovery;
  const result = await loadFn(input.workspacePath, sessionId, {
    limit: input.limit ?? CLAUDE_UI_HISTORY_WINDOW,
    before: input.before,
  });
  const record = result as {
    messages?: unknown;
    hasMore?: boolean;
    nextCursor?: string | null;
  } | null;
  const messagesData = record?.messages ?? result;
  const items = parseFn({
    messagesData,
    workspacePath: input.workspacePath,
    workspaceId: input.workspaceId,
    threadId: input.threadId,
    sessionId,
  });
  return {
    items,
    hasMore: record?.hasMore === true,
    nextCursor: record?.nextCursor ?? null,
  };
}
