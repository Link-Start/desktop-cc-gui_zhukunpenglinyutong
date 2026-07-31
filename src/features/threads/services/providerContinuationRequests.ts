import type { ProviderContinuationTargetInput } from "../../../services/tauri/sessionManagement";

export type ProviderContinuationDialogRequest = {
  workspaceId: string;
  sourceSessionId: string;
  destination: ProviderContinuationTargetInput;
};

type ProviderContinuationRequestListener = (
  request: ProviderContinuationDialogRequest,
) => void;

const providerContinuationRequestListeners =
  new Set<ProviderContinuationRequestListener>();

export function requestProviderContinuationDialog(
  request: ProviderContinuationDialogRequest,
): void {
  providerContinuationRequestListeners.forEach((listener) => listener(request));
}

export function subscribeProviderContinuationDialogRequests(
  listener: ProviderContinuationRequestListener,
): () => void {
  providerContinuationRequestListeners.add(listener);
  return () => {
    providerContinuationRequestListeners.delete(listener);
  };
}
