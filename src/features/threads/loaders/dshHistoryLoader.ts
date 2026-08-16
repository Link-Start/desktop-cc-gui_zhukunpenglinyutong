import type { HistoryLoader } from "../contracts/conversationCurtainContracts";
import { normalizeHistorySnapshot } from "../contracts/conversationCurtainContracts";
import { parseDshHistoryMessages } from "./dshHistoryParser";

type DshHistoryLoaderOptions = {
  workspaceId: string;
  workspacePath: string | null;
  loadDshSession: (
    workspacePath: string,
    sessionId: string,
  ) => Promise<unknown>;
};

export function createDshHistoryLoader({
  workspaceId,
  workspacePath,
  loadDshSession,
}: DshHistoryLoaderOptions): HistoryLoader {
  return {
    engine: "dsh",
    async load(threadId: string) {
      const sessionId = threadId.startsWith("dsh:")
        ? threadId.slice("dsh:".length)
        : threadId;
      if (!workspacePath) {
        return normalizeHistorySnapshot({
          engine: "dsh",
          workspaceId,
          threadId,
          meta: {
            workspaceId,
            threadId,
            engine: "dsh",
            activeTurnId: null,
            isThinking: false,
            heartbeatPulse: null,
            historyRestoredAtMs: Date.now(),
          },
        });
      }

      const result = await loadDshSession(workspacePath, sessionId);
      const record = result as { messages?: unknown };
      const items = parseDshHistoryMessages(record.messages ?? result);

      return normalizeHistorySnapshot({
        engine: "dsh",
        workspaceId,
        threadId,
        items,
        plan: null,
        userInputQueue: [],
        meta: {
          workspaceId,
          threadId,
          engine: "dsh",
          activeTurnId: null,
          isThinking: false,
          heartbeatPulse: null,
          historyRestoredAtMs: Date.now(),
        },
      });
    },
  };
}
