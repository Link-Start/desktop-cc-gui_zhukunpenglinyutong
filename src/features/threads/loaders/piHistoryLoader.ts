import type { HistoryLoader } from "../contracts/conversationCurtainContracts";
import { normalizeHistorySnapshot } from "../contracts/conversationCurtainContracts";
import type { HistoryLoadingProgressListener } from "../utils/historyLoadingProgress";
import { runNativeHistoryFetchAndParse } from "../utils/runNativeHistoryOpenStages";
import { parsePiHistoryMessages } from "./piHistoryParser";

type PiHistoryLoaderOptions = {
  workspaceId: string;
  workspacePath: string | null;
  loadPiSession: (workspacePath: string, sessionId: string) => Promise<unknown>;
  onProgress?: HistoryLoadingProgressListener;
};

export function createPiHistoryLoader({
  workspaceId,
  workspacePath,
  loadPiSession,
  onProgress,
}: PiHistoryLoaderOptions): HistoryLoader {
  return {
    engine: "pi",
    async load(threadId: string) {
      const sessionId = threadId.startsWith("pi:")
        ? threadId.slice("pi:".length)
        : threadId;
      if (!workspacePath) {
        return normalizeHistorySnapshot({
          engine: "pi",
          workspaceId,
          threadId,
          meta: {
            workspaceId,
            threadId,
            engine: "pi",
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
        load: () => loadPiSession(workspacePath, sessionId),
        extractMessages: (payload) =>
          ((payload ?? {}) as { messages?: unknown }).messages ?? payload,
        parse: parsePiHistoryMessages,
      });
      const items = staged?.items ?? [];

      return normalizeHistorySnapshot({
        engine: "pi",
        workspaceId,
        threadId,
        items,
        plan: null,
        userInputQueue: [],
        meta: {
          workspaceId,
          threadId,
          engine: "pi",
          activeTurnId: null,
          isThinking: false,
          heartbeatPulse: null,
          historyRestoredAtMs: Date.now(),
        },
      });
    },
  };
}
