import { useEffect, useState } from "react";
import type { OrchestrationTaskStoreData } from "../types";
import {
  loadOrchestrationTaskStore,
  ORCHESTRATION_TASK_STORE_UPDATED_EVENT,
} from "../utils/taskStore";
import { setVisibilityGatedInterval } from "../../../services/visibilityGatedInterval";

// 主通道是 saveOrchestrationTaskStore 的写入即广播事件（同 webview 内零延迟）；
// 轮询仅作跨窗口/异常路径的兜底，30s 足够且几乎不产生渲染
// （refresh 有内容比较守卫，内容不变保留旧引用）。
const DEFAULT_REFRESH_INTERVAL_MS = 30_000;

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

    if (typeof window !== "undefined") {
      window.addEventListener(ORCHESTRATION_TASK_STORE_UPDATED_EVENT, refresh);
    }

    const cleanupInterval =
      refreshIntervalMs > 0
        ? // 本 hook 挂在布局根上；隐藏时暂停兜底轮询，恢复可见时立即补一次刷新。
          setVisibilityGatedInterval(refresh, refreshIntervalMs)
        : null;

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(ORCHESTRATION_TASK_STORE_UPDATED_EVENT, refresh);
      }
      cleanupInterval?.();
    };
  }, [refreshIntervalMs]);

  return store;
}
