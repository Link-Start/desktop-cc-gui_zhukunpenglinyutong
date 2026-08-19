import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { PROVIDER_CONTINUATION_UI_ROLLBACK_EVENT } from "../../threads/services/providerContinuationRequests";

export type NativeAtomicSelectionOverlay = {
  modelCatalogEntryId: string;
  model: string;
};

/**
 * Native Atomic 勾选 overlay：只做瞬时反馈，不算 send 权威。
 * 切会话 / 引擎 / 渠道，或续接取消时必须清掉，避免底栏停在 destination。
 */
export function useNativeAtomicSelectionOverlay(
  resetKey: string,
): [
  NativeAtomicSelectionOverlay | null,
  Dispatch<SetStateAction<NativeAtomicSelectionOverlay | null>>,
] {
  const [overlay, setOverlay] = useState<NativeAtomicSelectionOverlay | null>(
    null,
  );

  useEffect(() => {
    setOverlay((prev) => (prev === null ? prev : null));
  }, [resetKey]);

  useEffect(() => {
    const onRollback = () => {
      setOverlay((prev) => (prev === null ? prev : null));
    };
    window.addEventListener(
      PROVIDER_CONTINUATION_UI_ROLLBACK_EVENT,
      onRollback,
    );
    return () => {
      window.removeEventListener(
        PROVIDER_CONTINUATION_UI_ROLLBACK_EVENT,
        onRollback,
      );
    };
  }, []);

  return [overlay, setOverlay];
}
