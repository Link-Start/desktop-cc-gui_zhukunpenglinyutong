import { useEffect, useState } from "react";
import type { TaskRunStoreData } from "../types";
import { loadTaskRunStore } from "../utils/taskRunStorage";
import { setVisibilityGatedInterval } from "../../../services/visibilityGatedInterval";

const DEFAULT_REFRESH_INTERVAL_MS = 2_000;

function areTaskRunStoresEqual(left: TaskRunStoreData, right: TaskRunStoreData): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function useTaskRunStore(options?: { refreshIntervalMs?: number }): TaskRunStoreData {
  const refreshIntervalMs = options?.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS;
  const [store, setStore] = useState<TaskRunStoreData>(() => loadTaskRunStore());

  useEffect(() => {
    const refresh = () => {
      const nextStore = loadTaskRunStore();
      setStore((currentStore) =>
        areTaskRunStoresEqual(currentStore, nextStore) ? currentStore : nextStore,
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
