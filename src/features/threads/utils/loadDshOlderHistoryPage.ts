import { loadDshSession } from "../../../services/tauri/session";
import { DSH_UI_HISTORY_WINDOW } from "../loaders/dshHistoryLoader";
import { parseDshHistoryMessages } from "../loaders/dshHistoryParser";
import type {
  LoadOlderHistoryPageInput,
  LoadOlderHistoryPageResult,
} from "./olderHistoryPage";

export type LoadDshOlderHistoryPageInput = LoadOlderHistoryPageInput & {
  loadDshSessionFn?: typeof loadDshSession;
  parseMessagesFn?: typeof parseDshHistoryMessages;
};

function resolveDshSessionId(threadId: string): string {
  return threadId.startsWith("dsh:") ? threadId.slice("dsh:".length) : threadId;
}

export async function loadDshOlderHistoryPage(
  input: LoadDshOlderHistoryPageInput,
): Promise<LoadOlderHistoryPageResult> {
  const sessionId = resolveDshSessionId(input.threadId);
  const loadFn = input.loadDshSessionFn ?? loadDshSession;
  const parseFn = input.parseMessagesFn ?? parseDshHistoryMessages;
  const result = await loadFn(input.workspacePath, sessionId, {
    limit: input.limit ?? DSH_UI_HISTORY_WINDOW,
    before: input.before,
  });
  const record = result as {
    messages?: unknown;
    hasMore?: boolean;
    nextCursor?: string | null;
  } | null;
  const items = parseFn(record?.messages ?? result);
  return {
    items,
    hasMore: record?.hasMore === true,
    nextCursor: record?.nextCursor ?? null,
  };
}
