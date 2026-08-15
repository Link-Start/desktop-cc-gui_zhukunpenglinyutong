import { useCallback, useEffect, useRef, useState } from "react";
import {
  getClientStoreSync,
  isClientStoreReady,
  subscribeClientStoreHydrated,
  writeClientStoreValue,
} from "../../../services/clientStorage";

const DEFAULT_HEIGHT = 80;
const MIN_HEIGHT = 20;
const MAX_HEIGHT = 400;

function readStoredTextareaHeight(): number | undefined {
  const stored = getClientStoreSync<number>("composer", "textareaHeight");
  if (stored !== undefined && Number.isFinite(stored) && stored >= MIN_HEIGHT && stored <= MAX_HEIGHT) {
    return stored;
  }
  return undefined;
}

export function useComposerEditorState() {
  const userAdjustedRef = useRef(false);
  const [textareaHeight, setTextareaHeight] = useState(() => {
    return readStoredTextareaHeight() ?? DEFAULT_HEIGHT;
  });

  useEffect(() => {
    const applyStoredHeight = () => {
      if (userAdjustedRef.current) {
        return;
      }
      const stored = readStoredTextareaHeight();
      if (stored !== undefined) {
        setTextareaHeight(stored);
      }
    };
    if (isClientStoreReady("composer")) {
      applyStoredHeight();
      return;
    }
    return subscribeClientStoreHydrated((store) => {
      if (store === "composer") {
        applyStoredHeight();
      }
    });
  }, []);

  useEffect(() => {
    if (!isClientStoreReady("composer")) {
      return;
    }
    writeClientStoreValue("composer", "textareaHeight", textareaHeight);
  }, [textareaHeight]);

  const handleHeightChange = useCallback((height: number) => {
    userAdjustedRef.current = true;
    setTextareaHeight(height);
  }, []);

  return { textareaHeight, onTextareaHeightChange: handleHeightChange };
}
