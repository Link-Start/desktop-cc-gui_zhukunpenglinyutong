import { useCallback, useState } from "react";

export type ThreadHistoryLoadState = true | "failed";

export function useThreadHistoryLoadingState() {
  const [historyLoadingByThreadId, setHistoryLoadingByThreadId] = useState<
    Record<string, ThreadHistoryLoadState>
  >({});

  const setThreadHistoryLoading = useCallback(
    (threadId: string, isLoading: boolean) => {
      if (!threadId) {
        return;
      }
      setHistoryLoadingByThreadId((current) => {
        const alreadyLoading = current[threadId] === true;
        if (isLoading) {
          if (alreadyLoading) {
            return current;
          }
          return { ...current, [threadId]: true };
        }
        if (!alreadyLoading) {
          return current;
        }
        const { [threadId]: _removed, ...rest } = current;
        return rest;
      });
    },
    [],
  );

  const setThreadHistoryRecoveryFailed = useCallback(
    (threadId: string, failed: boolean) => {
      if (!threadId) {
        return;
      }
      setHistoryLoadingByThreadId((current) => {
        if (failed) {
          if (current[threadId] === "failed") {
            return current;
          }
          return { ...current, [threadId]: "failed" };
        }
        if (current[threadId] !== "failed") {
          return current;
        }
        const { [threadId]: _removed, ...rest } = current;
        return rest;
      });
    },
    [],
  );

  return {
    historyLoadingByThreadId,
    setThreadHistoryLoading,
    setThreadHistoryRecoveryFailed,
  };
}
