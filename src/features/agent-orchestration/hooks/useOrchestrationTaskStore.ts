import { useEffect, useState } from "react";
import type { OrchestrationTaskStoreData } from "../types";
import { loadOrchestrationTaskStore } from "../utils/taskStore";
import { setVisibilityGatedInterval } from "../../../services/visibilityGatedInterval";

const DEFAULT_REFRESH_INTERVAL_MS = 2_000;

function areOrchestrationTaskStoresEqual(
  left: OrchestrationTaskStoreData,
  right: OrchestrationTaskStoreData,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function useOrchestrationTaskStore(options?: {
  refreshIntervalMs?: number;
}): OrchestrationTaskStoreData {
  const refreshIntervalMs = options?.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS;
  const [store, setStore] = useState<OrchestrationTaskStoreData>(() =>
    loadOrchestrationTaskStore(),
  );

  useEffect(() => {
    const refresh = () => {
      const nextStore = loadOrchestrationTaskStore();
      setStore((currentStore) =>
        areOrchestrationTaskStoresEqual(currentStore, nextStore) ? currentStore : nextStore,
      );
    };

    refresh();

    if (refreshIntervalMs <= 0) {
      return undefined;
    }

    // 本 hook 挂在布局根上；隐藏时暂停轮询，避免后台每 2s 做全量
    // normalize + stringify 比较。恢复可见时立即补一次刷新。
    return setVisibilityGatedInterval(refresh, refreshIntervalMs);
  }, [refreshIntervalMs]);

  return store;
}
