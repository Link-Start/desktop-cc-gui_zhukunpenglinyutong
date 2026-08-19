import { subscribeDshHistoryLoadProgress } from "../../../services/events";
import type { HistoryLoadingProgressListener } from "./historyLoadingProgress";
import {
  mapDshHistoryLoadProgressEvent,
  matchesDshHistoryLoadSession,
} from "./historyLoadingProgress";

export function subscribeMappedDshHistoryLoadProgress(options: {
  threadId: string;
  hostSessionId: string;
  onProgress: HistoryLoadingProgressListener;
}): () => void {
  return subscribeDshHistoryLoadProgress((event) => {
    if (
      !matchesDshHistoryLoadSession(
        event.sessionId,
        options.threadId,
        options.hostSessionId,
      )
    ) {
      return;
    }
    options.onProgress(mapDshHistoryLoadProgressEvent(event));
  });
}
