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

export function hasThreadDiskHistoryMore(threadId: string): boolean {
  const window = getThreadDiskHistoryWindow(threadId);
  if (window?.hasMore !== true) {
    return false;
  }
  const cursor = window.nextCursor?.trim() ?? "";
  return cursor.length > 0 && cursor !== "memory";
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
