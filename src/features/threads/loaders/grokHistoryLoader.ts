import type { HistoryLoader } from "../contracts/conversationCurtainContracts";
import { normalizeHistorySnapshot } from "../contracts/conversationCurtainContracts";
import { parseGrokHistoryMessages } from "./grokHistoryParser";

type GrokHistoryLoaderOptions = {
  workspaceId: string;
  workspacePath: string | null;
  loadGrokSession: (
    workspacePath: string,
    sessionId: string,
  ) => Promise<unknown>;
};

export function createGrokHistoryLoader({
  workspaceId,
  workspacePath,
  loadGrokSession,
}: GrokHistoryLoaderOptions): HistoryLoader {
  return {
    engine: "grok",
    async load(threadId: string) {
      const sessionId = threadId.startsWith("grok:")
        ? threadId.slice("grok:".length)
        : threadId;
      if (!workspacePath) {
        return normalizeHistorySnapshot({
          engine: "grok",
          workspaceId,
          threadId,
          meta: {
            workspaceId,
            threadId,
            engine: "grok",
            activeTurnId: null,
            isThinking: false,
            heartbeatPulse: null,
            historyRestoredAtMs: Date.now(),
          },
        });
      }

      const result = await loadGrokSession(workspacePath, sessionId);
      const record = result as { messages?: unknown };
      const messagesData = record.messages ?? result;
      const items = parseGrokHistoryMessages(messagesData);

      return normalizeHistorySnapshot({
        engine: "grok",
        workspaceId,
        threadId,
        items,
        plan: null,
        userInputQueue: [],
        meta: {
          workspaceId,
          threadId,
          engine: "grok",
          activeTurnId: null,
          isThinking: false,
          heartbeatPulse: null,
          historyRestoredAtMs: Date.now(),
        },
      });
    },
  };
}
