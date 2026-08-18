type OlderHistoryBeforePrependListener = (threadId: string) => void;

let olderHistoryBeforePrependListener: OlderHistoryBeforePrependListener | null =
  null;

export function setOlderHistoryBeforePrependListener(
  listener: OlderHistoryBeforePrependListener | null,
) {
  olderHistoryBeforePrependListener = listener;
}

export function notifyOlderHistoryBeforePrepend(threadId: string) {
  if (!threadId) {
    return;
  }
  olderHistoryBeforePrependListener?.(threadId);
}
