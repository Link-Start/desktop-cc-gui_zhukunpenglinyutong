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
import { isEditableShortcutTarget } from "../../../../utils/shortcuts";
import { SCROLL_THRESHOLD_PX } from "../../utils/messagesRenderUtils";
import { isMessagesScrollNearBottom } from "../presentation/messagesViewModel";
import {
  resolveConversationScrollEdgeTarget,
  startConversationScrollConvergence,
  type ConversationScrollEdge,
  type ConversationScrollMotion,
} from "../scrolling/messagesScrollConvergence";
import {
  isRecentUserScrollIntent,
  isScrollIntentKey,
  PROGRAMMATIC_SCROLL_ECHO_TOLERANCE_PX,
  readScrollGeometrySnapshot,
  recordProgrammaticScrollFingerprint,
  resolveClampedScrollTop,
  type ProgrammaticScrollFingerprint,
  type ScrollGeometrySnapshot,
} from "../scrolling/messagesScrollEcho";

const AUTOMATIC_BOTTOM_RECHECK_DELAYS_MS = [100, 300, 1_000, 2_000] as const;
const PROGRAMMATIC_SCROLL_ECHO_LIMIT = 32;

type ConversationScrollIntent =
  | "history-open"
  | "live-follow"
  | "turn-send"
  | "turn-settle"
  | "explicit-control";

function isFocusFollowScrollIntent(intent: ConversationScrollIntent | null) {
  return intent === "live-follow";
}

function isTurnBoundaryScrollIntent(intent: ConversationScrollIntent | null) {
  return intent === "turn-send" || intent === "turn-settle";
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomDeadlineRef = useRef(0);
  const stickToBottomIntentRef = useRef<
    "history-open" | "turn-send" | "turn-settle" | null
  >(null);
  const autoScrollRef = useRef(true);
  const activeScrollConvergenceCancelRef = useRef<(() => void) | null>(null);
  const activeProgrammaticScrollEdgeRef = useRef<ConversationScrollEdge | null>(null);
  const activeProgrammaticScrollMotionRef = useRef<ConversationScrollMotion | null>(null);
  const activeScrollIntentRef = useRef<ConversationScrollIntent | null>(null);
  const programmaticScrollTopEchoRef = useRef<ProgrammaticScrollFingerprint[]>([]);
  const lastUserScrollIntentAtRef = useRef<number | null>(null);
  const scrollGeometrySnapshotRef = useRef<ScrollGeometrySnapshot | null>(null);
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
  const hasRecentUserScrollIntent = useCallback(
    () =>
      isRecentUserScrollIntent(
        lastUserScrollIntentAtRef.current,
        performance.now(),
      ),
    [],
  );
  const clearUserScrollIntent = useCallback(() => {
    lastUserScrollIntentAtRef.current = null;
  }, []);
  const recordCurrentScrollGeometry = useCallback((container: HTMLDivElement) => {
    scrollGeometrySnapshotRef.current = readScrollGeometrySnapshot(container);
  }, []);
  const recordProgrammaticScrollEcho = useCallback(
    (fingerprint: ProgrammaticScrollFingerprint) => {
      recordProgrammaticScrollFingerprint(
        programmaticScrollTopEchoRef.current,
        fingerprint,
        PROGRAMMATIC_SCROLL_ECHO_LIMIT,
      );
    },
    [],
  );
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
        !isTurnBoundaryScrollIntent(intent) &&
        activeScrollIntentRef.current === "explicit-control" &&
        activeProgrammaticScrollMotionRef.current === "smooth"
      ) {
        return;
      }
      // shouldContinue 可能在首个同步 frame 就失败（例如 user-intent lease 已建立）。
      // start 后再失败会让同步 onComplete 早于 cancel handle 赋值，留下 stale owner。
      if (options?.shouldContinue && !options.shouldContinue()) {
        return;
      }
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
          if (appliedScrollTop === observedScrollTop) {
            return;
          }
          recordProgrammaticScrollEcho({
            recordedAt: performance.now(),
            scrollTop: appliedScrollTop,
            source: "write",
          });
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
    [cancelScrollConvergence, recordProgrammaticScrollEcho],
  );

  useLayoutEffect(() => {
    cancelScrollConvergence();
    initialBottomPinScopeRef.current = null;
    autoScrollRef.current = true;
    // fingerprint 属于 render scope；旧会话位置不得被新会话 write 重新续活。
    programmaticScrollTopEchoRef.current = [];
    lastUserScrollIntentAtRef.current = null;
    scrollGeometrySnapshotRef.current = null;
    stickToBottomDeadlineRef.current = 0;
    stickToBottomIntentRef.current = null;
  }, [cancelScrollConvergence, renderScopeKey]);
  useEffect(() => cancelScrollConvergence, [cancelScrollConvergence]);

  const requestAutoScroll = useCallback(() => {
    if (
      !liveAutoFollowEnabledRef.current ||
      !autoScrollRef.current ||
      !containerRef.current ||
      hasRecentUserScrollIntent() ||
      (!isWorkingRef.current && !isAssistantFinalizingRef.current)
    ) {
      return;
    }
    requestScrollConvergence("bottom", "instant", "live-follow", {
      recheckDelaysMs: AUTOMATIC_BOTTOM_RECHECK_DELAYS_MS,
      shouldContinue: () =>
        liveAutoFollowEnabledRef.current &&
        autoScrollRef.current &&
        !hasRecentUserScrollIntent() &&
        (isWorkingRef.current || isAssistantFinalizingRef.current),
    });
  }, [
    hasRecentUserScrollIntent,
    isAssistantFinalizingRef,
    isWorkingRef,
    liveAutoFollowEnabledRef,
    requestScrollConvergence,
  ]);
  const rearmAutoFollowToBottom = useCallback(() => {
    autoScrollRef.current = true;
    requestScrollConvergence("bottom", "instant", "live-follow", {
      recheckDelaysMs: AUTOMATIC_BOTTOM_RECHECK_DELAYS_MS,
      shouldContinue: () =>
        liveAutoFollowEnabledRef.current &&
        autoScrollRef.current &&
        !hasRecentUserScrollIntent() &&
        (isWorkingRef.current || isAssistantFinalizingRef.current),
    });
  }, [
    hasRecentUserScrollIntent,
    isAssistantFinalizingRef,
    isWorkingRef,
    liveAutoFollowEnabledRef,
    requestScrollConvergence,
  ]);
  const requestHistoryBottomConvergence = useCallback(() => {
    requestScrollConvergence("bottom", "instant", "history-open", {
      recheckDelaysMs: AUTOMATIC_BOTTOM_RECHECK_DELAYS_MS,
      shouldContinue: () =>
        autoScrollRef.current &&
        !hasRecentUserScrollIntent() &&
        Date.now() <= stickToBottomDeadlineRef.current,
    });
  }, [hasRecentUserScrollIntent, requestScrollConvergence]);
  const requestTimelineLayoutBottomConvergence = useCallback(() => {
    if (!autoScrollRef.current) {
      return;
    }
    stickToBottomIntentRef.current = "history-open";
    stickToBottomDeadlineRef.current = Date.now() + SETTLE_REPIN_WINDOW_MS;
    requestHistoryBottomConvergence();
  }, [requestHistoryBottomConvergence]);
  const requestTurnBoundaryBottomConvergence = useCallback(() => {
    const intent = stickToBottomIntentRef.current;
    if (!isTurnBoundaryScrollIntent(intent)) {
      return;
    }
    requestScrollConvergence("bottom", "instant", intent, {
      recheckDelaysMs: AUTOMATIC_BOTTOM_RECHECK_DELAYS_MS,
      shouldContinue: () =>
        stickToBottomIntentRef.current === intent &&
        autoScrollRef.current &&
        !hasRecentUserScrollIntent() &&
        Date.now() <= stickToBottomDeadlineRef.current,
    });
  }, [hasRecentUserScrollIntent, requestScrollConvergence]);
  const beginTurnBoundaryBottomConvergence = useCallback(
    (intent: "turn-send" | "turn-settle") => {
      clearUserScrollIntent();
      autoScrollRef.current = true;
      stickToBottomIntentRef.current = intent;
      stickToBottomDeadlineRef.current = Date.now() + SETTLE_REPIN_WINDOW_MS;
      requestTurnBoundaryBottomConvergence();
    },
    [clearUserScrollIntent, requestTurnBoundaryBottomConvergence],
  );
  // 内容高度与输入事件共同决定 follow ownership。所有 listener/observer 由 controller
  // 持有，避免 component 再维护第二套 convergence side effect。
  useEffect(() => {
    const container = containerRef.current;
    const content = container?.querySelector<HTMLElement>(".messages-timeline-root");
    if (!container) {
      return undefined;
    }
    let activePointerId: number | null = null;
    let pointerInside = container.matches(":hover");
    const markUserScrollIntent = () => {
      lastUserScrollIntentAtRef.current = performance.now();
      cancelScrollConvergence();
    };
    const handleWheel = (event: WheelEvent) => {
      if (event.deltaY === 0) {
        return;
      }
      markUserScrollIntent();
      if (event.deltaY < 0) {
        autoScrollRef.current = false;
      }
    };
    const handleTouchIntent = () => {
      markUserScrollIntent();
    };
    const handlePointerEnter = () => {
      pointerInside = true;
    };
    const handlePointerLeave = () => {
      pointerInside = false;
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || event.target !== container) {
        return;
      }
      activePointerId = event.pointerId;
      markUserScrollIntent();
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId === activePointerId) {
        markUserScrollIntent();
      }
    };
    const handlePointerEnd = (event: PointerEvent) => {
      if (event.pointerId === activePointerId) {
        activePointerId = null;
      }
    };
    const handleScrollKey = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        !isScrollIntentKey(event.key) ||
        isEditableShortcutTarget(event.target) ||
        isEditableShortcutTarget(document.activeElement)
      ) {
        return;
      }
      const eventTargetInside =
        event.target instanceof Node && container.contains(event.target);
      const activeElementInside =
        document.activeElement instanceof Node &&
        container.contains(document.activeElement);
      if (!eventTargetInside && !activeElementInside && !pointerInside) {
        return;
      }
      markUserScrollIntent();
    };
    const removeInputListeners = () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("touchstart", handleTouchIntent);
      container.removeEventListener("touchmove", handleTouchIntent);
      container.removeEventListener("pointerenter", handlePointerEnter);
      container.removeEventListener("pointerleave", handlePointerLeave);
      container.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
      window.removeEventListener("keydown", handleScrollKey);
      activePointerId = null;
    };
    container.addEventListener("wheel", handleWheel, { passive: true });
    container.addEventListener("touchstart", handleTouchIntent, { passive: true });
    container.addEventListener("touchmove", handleTouchIntent, { passive: true });
    container.addEventListener("pointerenter", handlePointerEnter);
    container.addEventListener("pointerleave", handlePointerLeave);
    container.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);
    window.addEventListener("keydown", handleScrollKey);
    recordCurrentScrollGeometry(container);
    if (!content || typeof ResizeObserver === "undefined") {
      return removeInputListeners;
    }
    const observer = new ResizeObserver(() => {
      const currentGeometry = readScrollGeometrySnapshot(container);
      const clampedScrollTop = resolveClampedScrollTop(
        scrollGeometrySnapshotRef.current,
        currentGeometry,
        PROGRAMMATIC_SCROLL_ECHO_TOLERANCE_PX,
      );
      if (clampedScrollTop !== null) {
        recordProgrammaticScrollEcho({
          recordedAt: performance.now(),
          scrollTop: clampedScrollTop,
          source: "clamp",
        });
      }
      scrollGeometrySnapshotRef.current = currentGeometry;
      if (autoScrollRef.current) {
        if (isWorkingRef.current || isAssistantFinalizingRef.current) {
          requestAutoScroll();
        } else if (Date.now() <= stickToBottomDeadlineRef.current) {
          if (stickToBottomIntentRef.current === "history-open") {
            requestHistoryBottomConvergence();
          } else if (isTurnBoundaryScrollIntent(stickToBottomIntentRef.current)) {
            requestTurnBoundaryBottomConvergence();
          }
        }
      }
      // convergence 首次 pulse 同步写 scrollTop；snapshot 必须反映写后的真实位置。
      recordCurrentScrollGeometry(container);
    });
    observer.observe(content);
    return () => {
      observer.disconnect();
      removeInputListeners();
      scrollGeometrySnapshotRef.current = null;
      lastUserScrollIntentAtRef.current = null;
    };
  }, [
    cancelScrollConvergence,
    isAssistantFinalizingRef,
    isWorkingRef,
    recordCurrentScrollGeometry,
    recordProgrammaticScrollEcho,
    renderScopeKey,
    requestAutoScroll,
    requestHistoryBottomConvergence,
    requestTurnBoundaryBottomConvergence,
  ]);
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
    beginTurnBoundaryBottomConvergence,
    cancelFocusFollowConvergence,
    cancelScrollConvergence,
    clearUserScrollIntent,
    containerRef,
    getPendingScrollResourceCount,
    handleScrollControlRequest,
    hasRecentUserScrollIntent,
    initialBottomPinScopeRef,
    isNearBottom,
    programmaticScrollTopEchoRef,
    rearmAutoFollowToBottom,
    recordCurrentScrollGeometry,
    requestAutoScroll,
    requestHistoryBottomConvergence,
    requestTimelineLayoutBottomConvergence,
    scrollKey,
    stickToBottomDeadlineRef,
    stickToBottomIntentRef,
  };
}
