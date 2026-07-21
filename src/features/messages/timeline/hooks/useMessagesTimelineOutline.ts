import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMessageOutlineActive } from "../../hooks/useMessageOutlineActive";
import {
  resolveNextMessageOutlineSnapshot,
  type MessageOutlineSnapshot,
} from "../../presentation/messagesOutlineState";

export function useMessagesTimelineOutline(input: {
  enabled: boolean;
  liveAssistantMessageId: string | null;
  threadId: string | null;
  workspaceId: string | null;
}) {
  const { enabled, liveAssistantMessageId, threadId, workspaceId } = input;
  const [currentOutline, setCurrentOutline] = useState<MessageOutlineSnapshot | null>(null);
  const floaterContainerRef = useRef<HTMLDivElement | null>(null);
  const handleLiveOutlineReady = useCallback((snapshot: MessageOutlineSnapshot) => {
    setCurrentOutline((previous) => resolveNextMessageOutlineSnapshot(previous, snapshot));
  }, []);
  const liveAssistantOutlineReady = useMemo(() => {
    if (!liveAssistantMessageId) {
      return undefined;
    }
    return (outline: MessageOutlineSnapshot["outline"]) => {
      handleLiveOutlineReady({ messageId: liveAssistantMessageId, outline });
    };
  }, [handleLiveOutlineReady, liveAssistantMessageId]);
  const { activeHeadingId } = useMessageOutlineActive(
    enabled ? (currentOutline?.outline ?? null) : null,
    floaterContainerRef,
  );

  useEffect(() => {
    setCurrentOutline(null);
  }, [threadId, workspaceId]);

  const handleJumpToHeading = useCallback((headingId: string) => {
    document.getElementById(headingId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  return {
    activeHeadingId,
    currentOutline,
    floaterContainerRef,
    handleJumpToHeading,
    liveAssistantOutlineReady,
  };
}
