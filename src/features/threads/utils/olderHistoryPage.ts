import type { ConversationItem } from "../../../types";
import { CLAUDE_UI_HISTORY_WINDOW } from "../loaders/claudeHistoryLoader";
import { DSH_UI_HISTORY_WINDOW } from "../loaders/dshHistoryLoader";
import { loadClaudeOlderHistoryPage } from "./loadClaudeOlderHistoryPage";
import { loadDshOlderHistoryPage } from "./loadDshOlderHistoryPage";

export type OlderHistoryDiskEngine = "claude" | "dsh";

export type LoadOlderHistoryPageInput = {
  threadId: string;
  workspaceId: string;
  workspacePath: string;
  before: string;
  limit?: number;
};

export type LoadOlderHistoryPageResult = {
  items: ConversationItem[];
  hasMore: boolean;
  nextCursor: string | null;
};

export function resolveOlderHistoryDiskEngine(
  threadId: string,
): OlderHistoryDiskEngine | null {
  if (threadId.startsWith("claude:")) {
    return "claude";
  }
  if (threadId.startsWith("dsh:")) {
    return "dsh";
  }
  return null;
}

export function resolveOlderHistoryDiskLimit(
  engine: OlderHistoryDiskEngine,
): number {
  return engine === "dsh" ? DSH_UI_HISTORY_WINDOW : CLAUDE_UI_HISTORY_WINDOW;
}

export async function loadRegisteredOlderHistoryPage(
  input: LoadOlderHistoryPageInput,
): Promise<LoadOlderHistoryPageResult> {
  const engine = resolveOlderHistoryDiskEngine(input.threadId);
  if (engine === "dsh") {
    return loadDshOlderHistoryPage(input);
  }
  if (engine === "claude") {
    return loadClaudeOlderHistoryPage(input);
  }
  return { items: [], hasMore: false, nextCursor: null };
}
