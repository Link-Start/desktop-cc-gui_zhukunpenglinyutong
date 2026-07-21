import {
  useCallback,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from "react";
import { MESSAGE_JUMP_EVENT_NAME } from "../../constants/messagesConstants";

type UseMessagesAnchorNavigationInput = {
  autoScrollRef: MutableRefObject<boolean>;
  commitActiveAnchorId: (messageId: string, mode: "sync") => void;
  containerRef: RefObject<HTMLDivElement | null>;
  messageNodeByIdRef: MutableRefObject<Map<string, HTMLDivElement>>;
  pendingJumpMessageId: string | null;
  revealAllHistoryItems: (reason: "jump") => void;
  setPendingJumpMessageId: Dispatch<SetStateAction<string | null>>;
  showAllHistoryItems: boolean;
  timelinePresentationSignal: unknown;
};

export function useMessagesAnchorNavigation({
  autoScrollRef,
  commitActiveAnchorId,
  containerRef,
  messageNodeByIdRef,
  pendingJumpMessageId,
  revealAllHistoryItems,
  setPendingJumpMessageId,
  showAllHistoryItems,
  timelinePresentationSignal,
}: UseMessagesAnchorNavigationInput) {
  const scrollToAnchor = useCallback((messageId: string) => {
    const node = messageNodeByIdRef.current.get(messageId);
    const container = containerRef.current;
    if (!node || !container) {
      return false;
    }
    const containerRect = container.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    const targetTop =
      container.scrollTop + (nodeRect.top - containerRect.top) - container.clientHeight * 0.28;
    autoScrollRef.current = false;
    container.scrollTo({
      top: Math.max(0, targetTop),
      behavior: "smooth",
    });
    commitActiveAnchorId(messageId, "sync");
    return true;
  }, [autoScrollRef, commitActiveAnchorId, containerRef, messageNodeByIdRef]);

  const requestScrollToAnchor = useCallback((messageId: string) => {
    if (scrollToAnchor(messageId)) {
      setPendingJumpMessageId(null);
      return;
    }
    setPendingJumpMessageId((previous) => (previous === messageId ? previous : messageId));
    if (!showAllHistoryItems) {
      revealAllHistoryItems("jump");
    }
  }, [revealAllHistoryItems, scrollToAnchor, setPendingJumpMessageId, showAllHistoryItems]);

  const handlePendingJumpTargetReady = useCallback((messageId: string) => {
    if (pendingJumpMessageId === messageId && scrollToAnchor(messageId)) {
      setPendingJumpMessageId(null);
    }
  }, [pendingJumpMessageId, scrollToAnchor, setPendingJumpMessageId]);

  useEffect(() => {
    if (pendingJumpMessageId && scrollToAnchor(pendingJumpMessageId)) {
      setPendingJumpMessageId(null);
    }
  }, [pendingJumpMessageId, scrollToAnchor, setPendingJumpMessageId, timelinePresentationSignal]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }
    const handleJumpToMessage = (event: Event) => {
      const messageId =
        event instanceof CustomEvent && typeof event.detail === "string" ? event.detail : "";
      if (messageId) {
        requestScrollToAnchor(messageId);
      }
    };
    document.addEventListener(MESSAGE_JUMP_EVENT_NAME, handleJumpToMessage);
    return () => document.removeEventListener(MESSAGE_JUMP_EVENT_NAME, handleJumpToMessage);
  }, [requestScrollToAnchor]);

  return { handlePendingJumpTargetReady, requestScrollToAnchor };
}
