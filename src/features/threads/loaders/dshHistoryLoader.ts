import type { ThreadTokenUsage } from "../../../types";
import type { HistoryLoader } from "../contracts/conversationCurtainContracts";
import { normalizeHistorySnapshot } from "../contracts/conversationCurtainContracts";
import { asNumber, normalizeDshSessionStats } from "../utils/threadNormalize";
import type { HistoryLoadingProgressListener } from "../utils/historyLoadingProgress";
import { runNativeHistoryFetchAndParse } from "../utils/runNativeHistoryOpenStages";
import { subscribeMappedDshHistoryLoadProgress } from "../utils/subscribeMappedDshHistoryLoadProgress";
import { parseDshHistoryMessages } from "./dshHistoryParser";

type DshHistoryLoaderOptions = {
  workspaceId: string;
  workspacePath: string | null;
  loadDshSession: (
    workspacePath: string,
    sessionId: string,
  ) => Promise<unknown>;
  onProgress?: HistoryLoadingProgressListener;
};

export function createDshHistoryLoader({
  workspaceId,
  workspacePath,
  loadDshSession,
  onProgress,
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

      const report: HistoryLoadingProgressListener = (progress) => {
        onProgress?.(progress);
      };
      const stopPageProgress = subscribeMappedDshHistoryLoadProgress({
        threadId,
        hostSessionId: sessionId,
        onProgress: report,
      });
      try {
        const staged = await runNativeHistoryFetchAndParse({
          report,
          shouldContinue: () => true,
          load: () => loadDshSession(workspacePath, sessionId),
          extractMessages: (payload) =>
            (payload as { messages?: unknown } | null)?.messages ?? payload,
          parse: parseDshHistoryMessages,
        });
        const result = staged?.result ?? null;
        const items = staged?.items ?? [];
        return normalizeHistorySnapshot({
          engine: "dsh",
          workspaceId,
          threadId,
          items,
          plan: null,
          userInputQueue: [],
          tokenUsage: extractDshHistoryTokenUsage(result),
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
      } finally {
        stopPageProgress();
      }
    },
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function extractDshHistoryTokenUsage(result: unknown): ThreadTokenUsage | null {
  const usage = asRecord(asRecord(result)?.usage);
  if (!usage) {
    return null;
  }
  const inputTokens = asNumber(usage.inputTokens ?? usage.input_tokens);
  const outputTokens = asNumber(usage.outputTokens ?? usage.output_tokens);
  const cachedInputTokens = asNumber(
    usage.cacheReadInputTokens ?? usage.cache_read_input_tokens,
  );
  const cacheWriteTokens = asNumber(
    usage.cacheWriteInputTokens ?? usage.cache_write_input_tokens,
  );
  const sessionStats = normalizeDshSessionStats(
    usage.sessionStats ?? usage.session_stats,
  );
  if (
    inputTokens <= 0 &&
    outputTokens <= 0 &&
    cachedInputTokens <= 0 &&
    cacheWriteTokens <= 0 &&
    !sessionStats
  ) {
    return null;
  }
  const breakdown = {
    inputTokens,
    outputTokens,
    cachedInputTokens,
    totalTokens: inputTokens + outputTokens,
    reasoningOutputTokens: 0,
  };
  return {
    total: breakdown,
    last: breakdown,
    modelContextWindow: null,
    contextUsageSource: "dsh_history",
    contextUsageFreshness: "restored",
    sessionStats,
    cacheWriteInputTokens: cacheWriteTokens > 0 ? cacheWriteTokens : null,
  };
}
