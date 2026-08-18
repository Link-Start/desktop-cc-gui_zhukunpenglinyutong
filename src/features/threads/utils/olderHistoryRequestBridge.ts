export type OlderHistoryRequestOptions = {
  drainAll?: boolean;
};

type OlderHistoryRequester = (
  threadId: string,
  options?: OlderHistoryRequestOptions,
) => boolean;

let olderHistoryRequester: OlderHistoryRequester | null = null;

export function setOlderHistoryRequester(
  requester: OlderHistoryRequester | null,
) {
  olderHistoryRequester = requester;
}

export function requestOlderHistory(
  threadId: string,
  options?: OlderHistoryRequestOptions,
): boolean {
  if (!threadId) {
    return false;
  }
  return olderHistoryRequester?.(threadId, options) === true;
}
