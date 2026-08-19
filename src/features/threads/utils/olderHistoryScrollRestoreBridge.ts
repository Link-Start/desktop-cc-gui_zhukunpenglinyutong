export type OlderHistoryBeforePrependDetail = {
  prependedCount: number;
};

type OlderHistoryBeforePrependListener = (
  threadId: string,
  detail?: OlderHistoryBeforePrependDetail,
) => void;

let olderHistoryBeforePrependListener: OlderHistoryBeforePrependListener | null =
  null;

export function setOlderHistoryBeforePrependListener(
  listener: OlderHistoryBeforePrependListener | null,
) {
  olderHistoryBeforePrependListener = listener;
}

export function notifyOlderHistoryBeforePrepend(
  threadId: string,
  detail?: OlderHistoryBeforePrependDetail,
) {
  if (!threadId) {
    return;
  }
  olderHistoryBeforePrependListener?.(threadId, detail);
}
