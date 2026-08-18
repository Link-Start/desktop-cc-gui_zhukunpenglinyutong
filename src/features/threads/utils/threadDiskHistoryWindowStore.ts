export type ThreadDiskHistoryWindow = {
  hasMore: boolean;
  nextCursor: string | null;
};

const windowsByThread = new Map<string, ThreadDiskHistoryWindow>();
const listeners = new Set<() => void>();

function emitThreadDiskHistoryWindows() {
  for (const listener of listeners) {
    listener();
  }
}

export function publishThreadDiskHistoryWindows(
  record: Record<string, ThreadDiskHistoryWindow | undefined> | null | undefined,
) {
  windowsByThread.clear();
  if (record) {
    for (const [threadId, window] of Object.entries(record)) {
      if (!threadId || !window) {
        continue;
      }
      windowsByThread.set(threadId, {
        hasMore: window.hasMore === true,
        nextCursor: window.nextCursor ?? null,
      });
    }
  }
  emitThreadDiskHistoryWindows();
}

export function getThreadDiskHistoryWindow(
  threadId: string,
): ThreadDiskHistoryWindow | undefined {
  if (!threadId) {
    return undefined;
  }
  return windowsByThread.get(threadId);
}

export function isConsumableDiskHistoryCursor(
  cursor: string | null | undefined,
): cursor is string {
  const trimmed = cursor?.trim() ?? "";
  return trimmed.length > 0 && trimmed !== "memory";
}

export function resolveHistoryWindowAfterMemoryDrain(input: {
  hasMemoryPending: boolean;
  diskWindow: ThreadDiskHistoryWindow | undefined;
}): ThreadDiskHistoryWindow {
  const diskCursor = input.diskWindow?.nextCursor ?? null;
  if (
    input.diskWindow?.hasMore === true &&
    isConsumableDiskHistoryCursor(diskCursor)
  ) {
    return { hasMore: true, nextCursor: diskCursor };
  }
  if (input.hasMemoryPending) {
    return { hasMore: true, nextCursor: "memory" };
  }
  return {
    hasMore: input.diskWindow?.hasMore === true,
    nextCursor: diskCursor,
  };
}

export function hasThreadDiskHistoryMore(threadId: string): boolean {
  const window = getThreadDiskHistoryWindow(threadId);
  return (
    window?.hasMore === true && isConsumableDiskHistoryCursor(window.nextCursor)
  );
}

export function subscribeThreadDiskHistoryWindows(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetThreadDiskHistoryWindowsForTests() {
  windowsByThread.clear();
  emitThreadDiskHistoryWindows();
}
