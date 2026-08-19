import type { ConversationItem } from "../../../types";
import type { HistoryLoadingProgress } from "./historyLoadingProgress";
import {
  buildNativeHistoryFinalizeProgress,
  buildNativeHistoryHydrateProgress,
  buildNativeHistoryParseProgress,
  buildNativeHistoryPrepareProgress,
  buildNativeHistorySessionWaitingProgress,
  yieldHistoryLoadingPaint,
} from "./historyLoadingProgress";

export async function runNativeHistoryFetchAndParse<TResult>(options: {
  report: (progress: HistoryLoadingProgress) => void;
  shouldContinue: () => boolean;
  load: () => Promise<TResult>;
  extractMessages: (result: TResult) => unknown;
  parse: (messages: unknown) => ConversationItem[];
}): Promise<{ result: TResult; items: ConversationItem[] } | null> {
  const { report, shouldContinue } = options;
  report(buildNativeHistoryPrepareProgress());
  await yieldHistoryLoadingPaint();
  if (!shouldContinue()) {
    return null;
  }

  report(buildNativeHistorySessionWaitingProgress());
  await yieldHistoryLoadingPaint();
  if (!shouldContinue()) {
    return null;
  }

  const result = await options.load();
  if (!shouldContinue()) {
    return null;
  }

  const messages = options.extractMessages(result);
  const rawCount = Array.isArray(messages) ? messages.length : 0;
  report(buildNativeHistoryParseProgress(rawCount));
  await yieldHistoryLoadingPaint();
  if (!shouldContinue()) {
    return null;
  }

  return { result, items: options.parse(messages) };
}

export async function runNativeHistoryOpenStages<TResult>(options: {
  report: (progress: HistoryLoadingProgress) => void;
  shouldContinue: () => boolean;
  load: () => Promise<TResult>;
  extractMessages: (result: TResult) => unknown;
  parse: (messages: unknown) => ConversationItem[];
  hydrate: (items: ConversationItem[]) => Promise<void>;
}): Promise<{ result: TResult; items: ConversationItem[] } | null> {
  const fetched = await runNativeHistoryFetchAndParse(options);
  if (!fetched) {
    return null;
  }

  const { report, shouldContinue } = options;
  report(buildNativeHistoryHydrateProgress("start", fetched.items.length));
  await yieldHistoryLoadingPaint();
  if (!shouldContinue()) {
    return null;
  }

  await options.hydrate(fetched.items);
  if (!shouldContinue()) {
    return null;
  }

  report(buildNativeHistoryFinalizeProgress());
  return fetched;
}
