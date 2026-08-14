import { useCallback, useSyncExternalStore } from "react";
import {
  getLiveItemDeltaSnapshot,
  peekLiveItemDeltaMatching,
  resolveLiveItemDeltaSnapshotText,
  subscribeLiveItemDelta,
  type LiveItemDeltaLane,
} from "../utils/liveItemDeltaChannel";

const noopSubscribe = () => () => {};

/**
 * 订阅某线程某 item 的单 lane 流式增量（liveItemDeltaChannel）。
 * enabled=false 或 id 为空时订阅空 store、恒返回 null——满足 hook 调用次序
 * 恒定的同时，未流式的行零订阅开销。
 * 快照值是原始字符串（值比较即稳定），符合 useSyncExternalStore 对
 * getSnapshot 的一致性要求；itemId 命中容忍 reducer 的 -seg-N 改写。
 */
export function useLiveItemDelta(
  threadId: string | null | undefined,
  itemId: string | null | undefined,
  lane: LiveItemDeltaLane,
  enabled: boolean,
): string | null {
  const active = Boolean(enabled && threadId && itemId);
  const subscribe = useCallback(
    (listener: () => void) => {
      if (!active || !threadId) {
        return noopSubscribe();
      }
      return subscribeLiveItemDelta(threadId, listener);
    },
    [active, threadId],
  );
  const getSnapshot = useCallback(() => {
    if (!active || !threadId || !itemId) {
      return null;
    }
    return resolveLiveItemDeltaSnapshotText(
      getLiveItemDeltaSnapshot(threadId),
      itemId,
      lane,
    );
  }, [active, threadId, itemId, lane]);
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

/**
 * 非流式行的 residual 文本：通道权威累积仍有更长全文、而 durable 字段只有
 * 建壳碎片时，先继续展示通道全文，避免 isLive/isStreaming 关掉瞬间只剩首段，
 * 历史重载才恢复（对齐 MessageRow 正文 residual 模式）。
 */
export function resolveResidualLiveItemDeltaText(
  threadId: string,
  itemId: string,
  lane: LiveItemDeltaLane,
  durableText: string,
): string | null {
  const entry = peekLiveItemDeltaMatching(threadId, itemId, lane);
  if (!entry?.text) {
    return null;
  }
  const durable = durableText ?? "";
  if (entry.text.length <= durable.length) {
    return null;
  }
  return entry.text;
}
