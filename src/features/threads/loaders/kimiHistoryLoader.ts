import type { HistoryLoader } from "../contracts/conversationCurtainContracts";
import { normalizeHistorySnapshot } from "../contracts/conversationCurtainContracts";
import type { HistoryLoadingProgressListener } from "../utils/historyLoadingProgress";
import { runNativeHistoryFetchAndParse } from "../utils/runNativeHistoryOpenStages";
import { parseKimiHistoryMessages } from "./kimiHistoryParser";

type KimiHistoryLoaderOptions = {
  workspaceId: string;
  workspacePath: string | null;
  loadKimiSession: (
    workspacePath: string,
    sessionId: string,
  ) => Promise<unknown>;
  onProgress?: HistoryLoadingProgressListener;
};

export function createKimiHistoryLoader({
  workspaceId,
  workspacePath,
  loadKimiSession,
  onProgress,
}: KimiHistoryLoaderOptions): HistoryLoader {
  return {
    engine: "kimi",
    async load(threadId: string) {
      const sessionId = threadId.startsWith("kimi:")
        ? threadId.slice("kimi:".length)
        : threadId;
      if (!workspacePath) {
        return normalizeHistorySnapshot({
          engine: "kimi",
          workspaceId,
          threadId,
          meta: {
            workspaceId,
            threadId,
            engine: "kimi",
            activeTurnId: null,
            isThinking: false,
            heartbeatPulse: null,
            historyRestoredAtMs: Date.now(),
          },
        });
      }

      const staged = await runNativeHistoryFetchAndParse({
        report: (progress) => {
          onProgress?.(progress);
        },
        shouldContinue: () => true,
        load: () => loadKimiSession(workspacePath, sessionId),
        extractMessages: (payload) =>
          (payload as { messages?: unknown } | null)?.messages ?? payload,
        parse: parseKimiHistoryMessages,
      });
      const items = staged?.items ?? [];

      return normalizeHistorySnapshot({
        engine: "kimi",
        workspaceId,
        threadId,
        items,
        plan: null,
        userInputQueue: [],
        meta: {
          workspaceId,
          threadId,
          engine: "kimi",
          activeTurnId: null,
          isThinking: false,
          heartbeatPulse: null,
          historyRestoredAtMs: Date.now(),
          historyHasMore: false,
          historyNextCursor: null,
        },
      });
    },
  };
}
