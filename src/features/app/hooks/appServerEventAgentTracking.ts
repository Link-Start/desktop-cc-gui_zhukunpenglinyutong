import type { MutableRefObject } from "react";

type ThreadScopedMarkerTracker = Record<string, Record<string, true>>;

export function migrateThreadAgentEventTracking({
  sourceThreadId,
  targetThreadId,
  threadAgentDeltaSeenRef,
  nestedTrackerRefs,
}: {
  sourceThreadId: string;
  targetThreadId: string;
  threadAgentDeltaSeenRef: MutableRefObject<Record<string, true>>;
  nestedTrackerRefs: readonly MutableRefObject<ThreadScopedMarkerTracker>[];
}) {
  if (!sourceThreadId || !targetThreadId || sourceThreadId === targetThreadId) {
    return;
  }
  if (threadAgentDeltaSeenRef.current[sourceThreadId]) {
    threadAgentDeltaSeenRef.current[targetThreadId] = true;
    delete threadAgentDeltaSeenRef.current[sourceThreadId];
  }
  for (const trackerRef of nestedTrackerRefs) {
    const sourceTracker = trackerRef.current[sourceThreadId];
    if (!sourceTracker) {
      continue;
    }
    const targetTracker = trackerRef.current[targetThreadId] ?? {};
    Object.assign(targetTracker, sourceTracker);
    trackerRef.current[targetThreadId] = targetTracker;
    delete trackerRef.current[sourceThreadId];
  }
}
