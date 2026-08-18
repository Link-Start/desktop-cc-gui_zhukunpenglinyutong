import type { HistoryLoader } from "../contracts/conversationCurtainContracts";
import { normalizeHistorySnapshot } from "../contracts/conversationCurtainContracts";
import type { HistoryLoadingProgressListener } from "../utils/historyLoadingProgress";
import { runNativeHistoryFetchAndParse } from "../utils/runNativeHistoryOpenStages";
import { parseGrokHistoryMessages } from "./grokHistoryParser";

type GrokHistoryLoaderOptions = {
  workspaceId: string;
  workspacePath: string | null;
  loadGrokSession: (
    workspacePath: string,
    sessionId: string,
  ) => Promise<unknown>;
  onProgress?: HistoryLoadingProgressListener;
};

export function createGrokHistoryLoader({
  workspaceId,
  workspacePath,
  loadGrokSession,
  onProgress,
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

      const staged = await runNativeHistoryFetchAndParse({
        report: (progress) => {
          onProgress?.(progress);
        },
        shouldContinue: () => true,
        load: () => loadGrokSession(workspacePath, sessionId),
        extractMessages: (payload) =>
          (payload as { messages?: unknown } | null)?.messages ?? payload,
        parse: parseGrokHistoryMessages,
      });
      const items = staged?.items ?? [];

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
