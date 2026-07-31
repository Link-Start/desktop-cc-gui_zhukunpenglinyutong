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
/** 与 convergence 模块同阈值：已在目标边 ±1px 视为到位，避免无意义二次写。 */
const ACTIVE_CONVERGENCE_EDGE_TOLERANCE_PX = 1;

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
  isThinking: boolean;
  liveAutoFollowEnabledRef: MutableRefObject<boolean>;
  rawScrollKey: string;
  renderScopeKey: string;
};

export function useMessagesScrollController({
  clearPendingJumpMessage,
  isThinking,
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
  const liveFollowCoalesceRafRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (liveFollowCoalesceRafRef.current !== null) {
        window.cancelAnimationFrame(liveFollowCoalesceRafRef.current);
        liveFollowCoalesceRafRef.current = null;
      }
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
  const cancelLiveFollowCoalesce = useCallback(() => {
    if (liveFollowCoalesceRafRef.current !== null) {
      window.cancelAnimationFrame(liveFollowCoalesceRafRef.current);
      liveFollowCoalesceRafRef.current = null;
    }
  }, []);
  const cancelScrollConvergence = useCallback(() => {
    cancelLiveFollowCoalesce();
    activeScrollConvergenceCancelRef.current?.();
    activeScrollConvergenceCancelRef.current = null;
    activeProgrammaticScrollEdgeRef.current = null;
    activeProgrammaticScrollMotionRef.current = null;
    activeScrollIntentRef.current = null;
  }, [cancelLiveFollowCoalesce]);
  const cancelFocusFollowConvergence = useCallback(() => {
    cancelLiveFollowCoalesce();
    if (isFocusFollowScrollIntent(activeScrollIntentRef.current)) {
      // 只清 live-follow owner；不要走 cancelScrollConvergence 以免误清非 follow 的 coalesce 语义外的状态。
      activeScrollConvergenceCancelRef.current?.();
      activeScrollConvergenceCancelRef.current = null;
      activeProgrammaticScrollEdgeRef.current = null;
      activeProgrammaticScrollMotionRef.current = null;
      activeScrollIntentRef.current = null;
    }
  }, [cancelLiveFollowCoalesce]);
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
      const isSameActiveRun =
        activeScrollConvergenceCancelRef.current !== null &&
        activeScrollIntentRef.current === intent &&
        activeProgrammaticScrollEdgeRef.current === edge &&
        activeProgrammaticScrollMotionRef.current === motion;
      if (isSameActiveRun) {
        // 已在追同一条 edge：禁止 cancel/restart。
        // 快速流式下每次 delta/Resize 若都拆掉 recheck 并新建 pulse，会同步连写 scrollTop → 幕布抖。
        // active rAF 每帧会重读 target；recheck 间隙用 instant 单次 nudge 补高度增长。
        if (motion === "instant") {
          const target = resolveConversationScrollEdgeTarget(container, edge);
          const observedScrollTop = container.scrollTop;
          if (
            Math.abs(target - observedScrollTop) > ACTIVE_CONVERGENCE_EDGE_TOLERANCE_PX
          ) {
            container.scrollTop = target;
            if (container.scrollTop !== observedScrollTop) {
              recordProgrammaticScrollEcho({
                recordedAt: performance.now(),
                scrollTop: container.scrollTop,
                source: "write",
              });
            }
          }
        }
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

  // 焦点跟随 stick-to-bottom：只要 liveAutoFollow 开着且用户仍停在底部（autoScroll），
  // 内容高度变化就必须追真实底部。不得把资格绑死在 isWorking/finalizing——回合结束后
  // 思考折叠、full markdown、虚拟化 remeasure 仍会改 scrollHeight，否则会「总差一点」。
  // 关闭焦点跟随后此路径停手；turn-send/settle 仍走独立 boundary ownership。
  const canContinueFocusFollowStick = useCallback(
    () =>
      liveAutoFollowEnabledRef.current &&
      autoScrollRef.current &&
      !hasRecentUserScrollIntent(),
    [hasRecentUserScrollIntent, liveAutoFollowEnabledRef],
  );
  const flushLiveFollowStick = useCallback(() => {
    if (!canContinueFocusFollowStick() || !containerRef.current) {
      return;
    }
    requestScrollConvergence("bottom", "instant", "live-follow", {
      recheckDelaysMs: AUTOMATIC_BOTTOM_RECHECK_DELAYS_MS,
      shouldContinue: canContinueFocusFollowStick,
    });
  }, [canContinueFocusFollowStick, requestScrollConvergence]);
  // 同帧内 scrollKey + ResizeObserver + 工具块 onRequestAutoScroll 会连打；合并到下一帧
  // 再落位，避免同一布局周期多次 cancel/restart。
  const requestAutoScroll = useCallback(() => {
    if (!canContinueFocusFollowStick() || !containerRef.current) {
      return;
    }
    if (typeof window === "undefined") {
      flushLiveFollowStick();
      return;
    }
    if (liveFollowCoalesceRafRef.current !== null) {
      return;
    }
    liveFollowCoalesceRafRef.current = window.requestAnimationFrame(() => {
      liveFollowCoalesceRafRef.current = null;
      flushLiveFollowStick();
    });
  }, [canContinueFocusFollowStick, flushLiveFollowStick]);
  const rearmAutoFollowToBottom = useCallback(() => {
    // 显式打开焦点跟随：清掉 wheel 租约，否则 500ms 内 shouldContinue 会直接 no-op。
    clearUserScrollIntent();
    autoScrollRef.current = true;
    cancelLiveFollowCoalesce();
    flushLiveFollowStick();
  }, [cancelLiveFollowCoalesce, clearUserScrollIntent, flushLiveFollowStick]);
  const requestHistoryBottomConvergence = useCallback(() => {
    requestScrollConvergence("bottom", "instant", "history-open", {
      recheckDelaysMs: AUTOMATIC_BOTTOM_RECHECK_DELAYS_MS,
      shouldContinue: () =>
        autoScrollRef.current &&
        !hasRecentUserScrollIntent() &&
        Date.now() <= stickToBottomDeadlineRef.current,
    });
  }, [hasRecentUserScrollIntent, requestScrollConvergence]);
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
  const requestTimelineLayoutBottomConvergence = useCallback(() => {
    // Virtualization/static layout flips may call this while autoScroll was briefly
    // disarmed by a nearBottom false-negative during scrollHeight growth. If the
    // user is not actively scrolling, re-arm and pin so turn-settle still lands
    // on the latest messages.
    if (hasRecentUserScrollIntent()) {
      return;
    }
    if (!autoScrollRef.current) {
      // Only re-arm when a settle/open pin window is already active.
      // Mid-history readers who scrolled up stay put.
      const settleActive =
        stickToBottomIntentRef.current !== null &&
        Date.now() <= stickToBottomDeadlineRef.current;
      if (!settleActive) {
        return;
      }
      autoScrollRef.current = true;
    }
    // Preserve an active turn boundary intent; only default to history-open.
    if (!isTurnBoundaryScrollIntent(stickToBottomIntentRef.current)) {
      stickToBottomIntentRef.current = "history-open";
    }
    stickToBottomDeadlineRef.current = Date.now() + SETTLE_REPIN_WINDOW_MS;
    if (isTurnBoundaryScrollIntent(stickToBottomIntentRef.current)) {
      requestTurnBoundaryBottomConvergence();
      return;
    }
    requestHistoryBottomConvergence();
  }, [
    hasRecentUserScrollIntent,
    requestHistoryBottomConvergence,
    requestTurnBoundaryBottomConvergence,
  ]);
  const beginTurnBoundaryBottomConvergence = useCallback(
    (intent: "turn-send" | "turn-settle") => {
      // turn-settle 有意 re-pin：流式中用户上滚读历史后，回合结束仍贴最新
      // （Messages.live-behavior「re-pins on settle back-fill…」契约）。
      // 闲时上滚读历史不会触发 turn-settle（无 isWorking 边沿）。
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
      if (autoScrollRef.current && !hasRecentUserScrollIntent()) {
        // 优先级：焦点跟随 stick（全阶段）> settle/open 预算窗 boundary。
        // 高度增长时浏览器不会自动推 scrollTop；armed 贴底必须主动 re-pin。
        // Resize 路径同步 flush（同 run 复用 + 单次 nudge），不走 rAF coalesce，
        // 否则测高后一帧空白再跳底，快流时更像抖。
        if (liveAutoFollowEnabledRef.current) {
          flushLiveFollowStick();
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
    flushLiveFollowStick,
    hasRecentUserScrollIntent,
    liveAutoFollowEnabledRef,
    recordCurrentScrollGeometry,
    recordProgrammaticScrollEcho,
    renderScopeKey,
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
