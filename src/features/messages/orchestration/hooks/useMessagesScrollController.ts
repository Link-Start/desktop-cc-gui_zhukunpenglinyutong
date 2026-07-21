import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type MutableRefObject,
} from "react";
import {
  SETTLE_REPIN_WINDOW_MS,
} from "../../constants/messagesConstants";
import { SCROLL_THRESHOLD_PX } from "../../utils/messagesRenderUtils";
import { isMessagesScrollNearBottom } from "../presentation/messagesViewModel";
import {
  resolveConversationScrollEdgeTarget,
  startConversationScrollConvergence,
  type ConversationScrollEdge,
  type ConversationScrollMotion,
} from "../scrolling/messagesScrollConvergence";

const AUTOMATIC_BOTTOM_RECHECK_DELAYS_MS = [100, 300, 1_000, 2_000] as const;
const PROGRAMMATIC_SCROLL_ECHO_LIMIT = 16;

type ConversationScrollIntent =
  | "history-open"
  | "live-follow"
  | "turn-settle"
  | "explicit-control";

function isFocusFollowScrollIntent(intent: ConversationScrollIntent | null) {
  return intent === "live-follow" || intent === "turn-settle";
}

type UseMessagesScrollControllerInput = {
  clearPendingJumpMessage: () => void;
  isAssistantFinalizingRef: MutableRefObject<boolean>;
  isThinking: boolean;
  isWorkingRef: MutableRefObject<boolean>;
  liveAutoFollowEnabledRef: MutableRefObject<boolean>;
  rawScrollKey: string;
  renderScopeKey: string;
};

export function useMessagesScrollController({
  clearPendingJumpMessage,
  isAssistantFinalizingRef,
  isThinking,
  isWorkingRef,
  liveAutoFollowEnabledRef,
  rawScrollKey,
  renderScopeKey,
}: UseMessagesScrollControllerInput) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomDeadlineRef = useRef(0);
  const stickToBottomIntentRef = useRef<"history-open" | "turn-settle" | null>(null);
  const autoScrollRef = useRef(true);
  const activeScrollConvergenceCancelRef = useRef<(() => void) | null>(null);
  const activeProgrammaticScrollEdgeRef = useRef<ConversationScrollEdge | null>(null);
  const activeProgrammaticScrollMotionRef = useRef<ConversationScrollMotion | null>(null);
  const activeScrollIntentRef = useRef<ConversationScrollIntent | null>(null);
  const programmaticScrollTopEchoRef = useRef<number[]>([]);
  const initialBottomPinScopeRef = useRef<string | null>(null);
  const [scrollKey, setScrollKey] = useState(rawScrollKey);
  const [, startScrollKeyTransition] = useTransition();
  const scrollThrottleRef = useRef<number>(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  useEffect(() => {
    if (scrollThrottleRef.current) {
      window.clearTimeout(scrollThrottleRef.current);
    }
    scrollThrottleRef.current = window.setTimeout(() => {
      if (!mountedRef.current || typeof window === "undefined") {
        return;
      }
      startScrollKeyTransition(() => {
        setScrollKey((current) => (current === rawScrollKey ? current : rawScrollKey));
      });
    }, isThinking ? 120 : 0);
    return () => {
      if (scrollThrottleRef.current) {
        window.clearTimeout(scrollThrottleRef.current);
      }
    };
  }, [isThinking, rawScrollKey, startScrollKeyTransition]);

  const isNearBottom = useCallback(
    (node: HTMLDivElement) => isMessagesScrollNearBottom(node, SCROLL_THRESHOLD_PX),
    [],
  );
  const recordProgrammaticScrollObservation = useCallback((value: number) => {
    const echoes = programmaticScrollTopEchoRef.current;
    if (echoes[echoes.length - 1] === value) {
      return;
    }
    echoes.push(value);
    if (echoes.length > PROGRAMMATIC_SCROLL_ECHO_LIMIT) {
      echoes.splice(0, echoes.length - PROGRAMMATIC_SCROLL_ECHO_LIMIT);
    }
  }, []);
  const cancelScrollConvergence = useCallback(() => {
    activeScrollConvergenceCancelRef.current?.();
    activeScrollConvergenceCancelRef.current = null;
    activeProgrammaticScrollEdgeRef.current = null;
    activeProgrammaticScrollMotionRef.current = null;
    activeScrollIntentRef.current = null;
  }, []);
  const cancelFocusFollowConvergence = useCallback(() => {
    if (isFocusFollowScrollIntent(activeScrollIntentRef.current)) {
      cancelScrollConvergence();
    }
  }, [cancelScrollConvergence]);
  const requestScrollConvergence = useCallback(
    (
      edge: ConversationScrollEdge,
      motion: ConversationScrollMotion,
      intent: ConversationScrollIntent,
      options?: {
        recheckDelaysMs?: readonly number[];
        shouldContinue?: () => boolean;
      },
    ) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }
      if (
        intent !== "explicit-control" &&
        activeScrollIntentRef.current === "explicit-control" &&
        activeProgrammaticScrollMotionRef.current === "smooth"
      ) {
        return;
      }
      recordProgrammaticScrollObservation(container.scrollTop);
      if (
        activeScrollIntentRef.current === intent &&
        activeProgrammaticScrollEdgeRef.current === edge &&
        activeProgrammaticScrollMotionRef.current === motion &&
        Math.abs(resolveConversationScrollEdgeTarget(container, edge) - container.scrollTop) <= 1
      ) {
        return;
      }
      cancelScrollConvergence();
      activeProgrammaticScrollEdgeRef.current = edge;
      activeProgrammaticScrollMotionRef.current = motion;
      activeScrollIntentRef.current = intent;
      let cancelCurrentRun: (() => void) | null = null;
      cancelCurrentRun = startConversationScrollConvergence(container, {
        edge,
        motion,
        recheckDelaysMs: options?.recheckDelaysMs,
        shouldContinue: options?.shouldContinue,
        onFrameObservation: (observedScrollTop, appliedScrollTop) => {
          recordProgrammaticScrollObservation(observedScrollTop);
          recordProgrammaticScrollObservation(appliedScrollTop);
        },
        onComplete: () => {
          if (activeScrollConvergenceCancelRef.current !== cancelCurrentRun) {
            return;
          }
          activeScrollConvergenceCancelRef.current = null;
          activeProgrammaticScrollEdgeRef.current = null;
          activeProgrammaticScrollMotionRef.current = null;
          activeScrollIntentRef.current = null;
        },
      });
      activeScrollConvergenceCancelRef.current = cancelCurrentRun;
    },
    [cancelScrollConvergence, recordProgrammaticScrollObservation],
  );

  useLayoutEffect(() => {
    cancelScrollConvergence();
    initialBottomPinScopeRef.current = null;
    autoScrollRef.current = true;
    stickToBottomDeadlineRef.current = 0;
    stickToBottomIntentRef.current = null;
  }, [cancelScrollConvergence, renderScopeKey]);
  useEffect(() => cancelScrollConvergence, [cancelScrollConvergence]);

  const requestAutoScroll = useCallback(() => {
    if (
      !liveAutoFollowEnabledRef.current ||
      !autoScrollRef.current ||
      !containerRef.current ||
      (!isWorkingRef.current && !isAssistantFinalizingRef.current)
    ) {
      return;
    }
    requestScrollConvergence("bottom", "instant", "live-follow", {
      recheckDelaysMs: AUTOMATIC_BOTTOM_RECHECK_DELAYS_MS,
      shouldContinue: () =>
        liveAutoFollowEnabledRef.current &&
        autoScrollRef.current &&
        (isWorkingRef.current || isAssistantFinalizingRef.current),
    });
  }, [isAssistantFinalizingRef, isWorkingRef, liveAutoFollowEnabledRef, requestScrollConvergence]);
  const rearmAutoFollowToBottom = useCallback(() => {
    autoScrollRef.current = true;
    requestScrollConvergence("bottom", "instant", "live-follow", {
      recheckDelaysMs: AUTOMATIC_BOTTOM_RECHECK_DELAYS_MS,
      shouldContinue: () =>
        liveAutoFollowEnabledRef.current &&
        autoScrollRef.current &&
        (isWorkingRef.current || isAssistantFinalizingRef.current),
    });
  }, [isAssistantFinalizingRef, isWorkingRef, liveAutoFollowEnabledRef, requestScrollConvergence]);
  const requestHistoryBottomConvergence = useCallback(() => {
    requestScrollConvergence("bottom", "instant", "history-open", {
      recheckDelaysMs: AUTOMATIC_BOTTOM_RECHECK_DELAYS_MS,
      shouldContinue: () =>
        autoScrollRef.current && Date.now() <= stickToBottomDeadlineRef.current,
    });
  }, [requestScrollConvergence]);
  const requestTimelineLayoutBottomConvergence = useCallback(() => {
    if (!autoScrollRef.current) {
      return;
    }
    stickToBottomIntentRef.current = "history-open";
    stickToBottomDeadlineRef.current = Date.now() + SETTLE_REPIN_WINDOW_MS;
    requestHistoryBottomConvergence();
  }, [requestHistoryBottomConvergence]);
  const requestSettleBottomConvergence = useCallback(() => {
    requestScrollConvergence("bottom", "instant", "turn-settle", {
      recheckDelaysMs: AUTOMATIC_BOTTOM_RECHECK_DELAYS_MS,
      shouldContinue: () =>
        liveAutoFollowEnabledRef.current &&
        autoScrollRef.current &&
        Date.now() <= stickToBottomDeadlineRef.current,
    });
  }, [liveAutoFollowEnabledRef, requestScrollConvergence]);
  const handleScrollControlRequest = useCallback(
    (edge: ConversationScrollEdge) => {
      autoScrollRef.current = edge === "bottom";
      clearPendingJumpMessage();
      requestScrollConvergence(edge, "smooth", "explicit-control");
    },
    [clearPendingJumpMessage, requestScrollConvergence],
  );
  const getPendingScrollResourceCount = useCallback(
    () => (scrollThrottleRef.current ? 1 : 0),
    [],
  );

  return {
    activeProgrammaticScrollEdgeRef,
    activeProgrammaticScrollMotionRef,
    autoScrollRef,
    bottomRef,
    cancelFocusFollowConvergence,
    cancelScrollConvergence,
    containerRef,
    getPendingScrollResourceCount,
    handleScrollControlRequest,
    initialBottomPinScopeRef,
    isNearBottom,
    programmaticScrollTopEchoRef,
    rearmAutoFollowToBottom,
    recordProgrammaticScrollObservation,
    requestAutoScroll,
    requestHistoryBottomConvergence,
    requestSettleBottomConvergence,
    requestTimelineLayoutBottomConvergence,
    scrollKey,
    stickToBottomDeadlineRef,
    stickToBottomIntentRef,
  };
}
