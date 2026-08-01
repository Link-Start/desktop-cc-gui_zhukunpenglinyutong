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
  createInitialScrollAuthorityState,
  reduceGeometry,
  reduceIntent,
  shouldContinuousPin,
} from "../scrolling/scrollAuthorityMachine";
import type { ScrollAuthorityState } from "../scrolling/scrollAuthorityTypes";
import { recordTicketAppliedScrollTop } from "../scrolling/scrollWriteTicket";
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

/**
 * 权威回底原因：与 ScrollControl「回到底部」共用同一 pin 通道。
 * - explicit：按钮（smooth）
 * - turn-send / turn-settle：回合边界（instant + forced）
 * - history-open：打开会话
 * - history-restore：尾窗回全量 / 虚拟化 handoff 后的二次贴底（instant + 再入 forced）
 * - focus-rearm：焦点跟随重新打开
 */
type PinCanvasToBottomReason =
  | "explicit"
  | "turn-send"
  | "turn-settle"
  | "history-open"
  | "history-restore"
  | "focus-rearm";

function isFocusFollowScrollIntent(intent: ConversationScrollIntent | null) {
  return intent === "live-follow";
}

function isTurnBoundaryScrollIntent(intent: ConversationScrollIntent | null) {
  return intent === "turn-send" || intent === "turn-settle";
}

type UseMessagesScrollControllerInput = {
  clearPendingJumpMessage: () => void;
  isThinking: boolean;
  /**
   * Claude/Codex finalizing 窗（Claude 320ms / Codex 6s；Grok 等为 false）：
   * staged MD、file-change、测高等会继续改高度。挡住假稳退役，起止再 pin。
   */
  isAssistantFinalizing?: boolean;
  liveAutoFollowEnabledRef: MutableRefObject<boolean>;
  rawScrollKey: string;
  renderScopeKey: string;
};

export function useMessagesScrollController({
  clearPendingJumpMessage,
  isThinking,
  isAssistantFinalizing = false,
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
  /** Scroll Ownership 权威状态（纯机）；与 legacy deadline/autoScroll 双跑一期 */
  const scrollAuthorityRef = useRef<ScrollAuthorityState>(
    createInitialScrollAuthorityState({
      liveAutoFollowEnabled: liveAutoFollowEnabledRef.current,
      now: typeof performance !== "undefined" ? performance.now() : Date.now(),
    }),
  );
  const scopeGenerationRef = useRef(0);
  const previousAssistantFinalizingRef = useRef(isAssistantFinalizing);
  const isAssistantFinalizingRef = useRef(isAssistantFinalizing);
  isAssistantFinalizingRef.current = isAssistantFinalizing;

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
          const authority = scrollAuthorityRef.current;
          if (authority.ticket) {
            scrollAuthorityRef.current = {
              ...authority,
              ticket: recordTicketAppliedScrollTop(authority.ticket, appliedScrollTop),
            };
          }
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
    scopeGenerationRef.current += 1;
    scrollAuthorityRef.current = createInitialScrollAuthorityState({
      liveAutoFollowEnabled: liveAutoFollowEnabledRef.current,
      scopeGeneration: scopeGenerationRef.current,
      now: performance.now(),
    });
  }, [cancelScrollConvergence, liveAutoFollowEnabledRef, renderScopeKey]);
  useEffect(() => cancelScrollConvergence, [cancelScrollConvergence]);

  // 焦点跟随 stick-to-bottom：只要 liveAutoFollow 开着且用户仍停在底部（autoScroll），
  // 内容高度变化就必须追真实底部。不得把资格绑死在 isWorking/finalizing——回合结束后
  // 思考折叠、full markdown、虚拟化 remeasure 仍会改 scrollHeight，否则会「总差一点」。
  // 关闭焦点跟随后此路径停手；turn-send/settle 仍走独立 boundary ownership。
  const canContinueFocusFollowStick = useCallback(() => {
    if (hasRecentUserScrollIntent() || !autoScrollRef.current) {
      return false;
    }
    const authorityMode = scrollAuthorityRef.current.mode;
    // forced-bottom：安全阀/稳态前持续追底（F 类），不被 2.4s deadline 单独掐死
    if (authorityMode === "forced-bottom") {
      return true;
    }
    if (!liveAutoFollowEnabledRef.current) {
      return false;
    }
    // stick 或尚未同步的 free+autoScroll（re-arm 竞态）都允许追底
    return shouldContinuousPin(authorityMode) || authorityMode === "free";
  }, [hasRecentUserScrollIntent, liveAutoFollowEnabledRef]);
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
  /**
   * 权威回底原语（与 ScrollControl「回到底部」同一通道）。
   * 所有发送/settle/历史回刷/打开会话/按钮 的贴底都必须经此入口，禁止旁路只写一次 scrollTop。
   */
  const pinCanvasToBottom = useCallback(
    (reason: PinCanvasToBottomReason, motionOverride?: ConversationScrollMotion) => {
      // 与按钮一致：清干扰 + 武装跟随 + 清 jump
      clearUserScrollIntent();
      autoScrollRef.current = true;
      clearPendingJumpMessage();
      cancelLiveFollowCoalesce();

      const now = performance.now();
      const motion: ConversationScrollMotion =
        motionOverride ?? (reason === "explicit" ? "smooth" : "instant");
      const armDeadline = () => {
        stickToBottomDeadlineRef.current = Date.now() + SETTLE_REPIN_WINDOW_MS;
      };

      let convergenceIntent: ConversationScrollIntent = "explicit-control";
      const liveFollow = liveAutoFollowEnabledRef.current;

      if (reason === "explicit") {
        // 按钮：explicit-bottom 武装 stick，并再入 forced 以便 RO 追迟到测高
        let decision = reduceIntent(
          {
            ...scrollAuthorityRef.current,
            liveAutoFollowEnabled: liveFollow,
          },
          { type: "explicit-bottom" },
          now,
        );
        decision = reduceIntent(
          {
            ...decision.state,
            liveAutoFollowEnabled: liveFollow,
          },
          { type: "turn-settle" },
          now,
        );
        scrollAuthorityRef.current = decision.state;
        stickToBottomIntentRef.current = "turn-settle";
        armDeadline();
        convergenceIntent = "explicit-control";
      } else if (reason === "turn-send" || reason === "turn-settle") {
        stickToBottomIntentRef.current = reason;
        armDeadline();
        const decision = reduceIntent(
          {
            ...scrollAuthorityRef.current,
            liveAutoFollowEnabled: liveFollow,
          },
          { type: reason },
          now,
        );
        scrollAuthorityRef.current = decision.state;
        convergenceIntent = reason;
      } else if (reason === "history-open") {
        stickToBottomIntentRef.current = "history-open";
        armDeadline();
        const decision = reduceIntent(
          {
            ...scrollAuthorityRef.current,
            liveAutoFollowEnabled: liveFollow,
          },
          { type: "open-thread" },
          now,
        );
        scrollAuthorityRef.current = decision.state;
        convergenceIntent = "history-open";
      } else if (reason === "history-restore") {
        // 尾窗回全量 / 虚拟化 handoff：再入 forced，与按钮同款武装，追新真底
        const keepTurn: "turn-send" | "turn-settle" =
          stickToBottomIntentRef.current === "turn-send" ? "turn-send" : "turn-settle";
        stickToBottomIntentRef.current = keepTurn;
        armDeadline();
        const decision = reduceIntent(
          {
            ...scrollAuthorityRef.current,
            liveAutoFollowEnabled: liveFollow,
          },
          { type: keepTurn },
          now,
        );
        scrollAuthorityRef.current = decision.state;
        convergenceIntent = keepTurn;
      } else {
        // focus-rearm
        const decision = reduceIntent(
          {
            ...scrollAuthorityRef.current,
            liveAutoFollowEnabled: true,
          },
          { type: "focus-follow-on" },
          now,
        );
        scrollAuthorityRef.current = decision.state;
        convergenceIntent = "live-follow";
      }

      const pinnedConvergenceIntent = convergenceIntent;
      requestScrollConvergence("bottom", motion, pinnedConvergenceIntent, {
        recheckDelaysMs: AUTOMATIC_BOTTOM_RECHECK_DELAYS_MS,
        shouldContinue: () => {
          if (!autoScrollRef.current || hasRecentUserScrollIntent()) {
            return false;
          }
          // forced：回刷/发送生命周期内持续追，不单靠 2.4s
          if (scrollAuthorityRef.current.mode === "forced-bottom") {
            return true;
          }
          // 按钮 explicit：与用户手感一致，autoScroll 武装则继续 recheck
          if (pinnedConvergenceIntent === "explicit-control") {
            return true;
          }
          if (pinnedConvergenceIntent === "live-follow") {
            return liveAutoFollowEnabledRef.current;
          }
          return Date.now() <= stickToBottomDeadlineRef.current;
        },
      });
    },
    [
      cancelLiveFollowCoalesce,
      clearPendingJumpMessage,
      clearUserScrollIntent,
      hasRecentUserScrollIntent,
      liveAutoFollowEnabledRef,
      requestScrollConvergence,
    ],
  );

  const rearmAutoFollowToBottom = useCallback(() => {
    pinCanvasToBottom("focus-rearm", "instant");
  }, [pinCanvasToBottom]);

  const requestHistoryBottomConvergence = useCallback(() => {
    pinCanvasToBottom("history-open", "instant");
  }, [pinCanvasToBottom]);

  /**
   * 已武装时继续追底（Resize / recheck 路径）。
   * 不得 clearUserScrollIntent / 不得完整 re-arm，否则会吞掉用户上滚。
   */
  const continueBottomPinIfArmed = useCallback(() => {
    if (!autoScrollRef.current || hasRecentUserScrollIntent()) {
      return;
    }
    const boundary = stickToBottomIntentRef.current;
    if (
      scrollAuthorityRef.current.mode === "forced-bottom" ||
      isTurnBoundaryScrollIntent(boundary)
    ) {
      const intent =
        isTurnBoundaryScrollIntent(boundary) && boundary
          ? boundary
          : "turn-settle";
      requestScrollConvergence("bottom", "instant", intent, {
        recheckDelaysMs: AUTOMATIC_BOTTOM_RECHECK_DELAYS_MS,
        shouldContinue: () => {
          if (!autoScrollRef.current || hasRecentUserScrollIntent()) {
            return false;
          }
          if (scrollAuthorityRef.current.mode === "forced-bottom") {
            return true;
          }
          return (
            isTurnBoundaryScrollIntent(stickToBottomIntentRef.current) &&
            Date.now() <= stickToBottomDeadlineRef.current
          );
        },
      });
      return;
    }
    if (liveAutoFollowEnabledRef.current) {
      flushLiveFollowStick();
    } else if (
      stickToBottomIntentRef.current === "history-open" &&
      Date.now() <= stickToBottomDeadlineRef.current
    ) {
      requestScrollConvergence("bottom", "instant", "history-open", {
        recheckDelaysMs: AUTOMATIC_BOTTOM_RECHECK_DELAYS_MS,
        shouldContinue: () =>
          autoScrollRef.current &&
          !hasRecentUserScrollIntent() &&
          Date.now() <= stickToBottomDeadlineRef.current,
      });
    }
  }, [
    flushLiveFollowStick,
    hasRecentUserScrollIntent,
    liveAutoFollowEnabledRef,
    requestScrollConvergence,
  ]);

  const requestTimelineLayoutBottomConvergence = useCallback(() => {
    // 虚拟化/static handoff、尾窗回全量：完整权威 pin（与按钮同通道），再入 forced。
    const forced = scrollAuthorityRef.current.mode === "forced-bottom";
    const boundaryIntent = stickToBottomIntentRef.current;
    const turnBoundaryActive =
      isTurnBoundaryScrollIntent(boundaryIntent) &&
      Date.now() <= stickToBottomDeadlineRef.current;
    // history-open 预算窗不能在用户已离底时强行 pin（否则流式上滚读历史会被拽回）
    if (hasRecentUserScrollIntent() && !forced && !turnBoundaryActive) {
      return;
    }
    if (!autoScrollRef.current && !forced && !turnBoundaryActive) {
      return;
    }
    pinCanvasToBottom("history-restore", "instant");
  }, [hasRecentUserScrollIntent, pinCanvasToBottom]);

  const beginTurnBoundaryBottomConvergence = useCallback(
    (intent: "turn-send" | "turn-settle") => {
      pinCanvasToBottom(intent, "instant");
    },
    [pinCanvasToBottom],
  );

  // Claude/Codex finalizing 生命周期（共用钩子，非引擎 if 分叉 pin 实现）：
  // - 开始：标 finalizingPresentationActive + turn-settle pin（再入 forced）
  // - 进行中：保持 flag，canRetireForced 禁止稳态退役
  // - 结束：清 flag + history-restore pin（与回到底部同通道）
  useLayoutEffect(() => {
    const wasFinalizing = previousAssistantFinalizingRef.current;
    previousAssistantFinalizingRef.current = isAssistantFinalizing;
    const now = performance.now();
    if (wasFinalizing && !isAssistantFinalizing) {
      scrollAuthorityRef.current = {
        ...scrollAuthorityRef.current,
        geometry: {
          ...scrollAuthorityRef.current.geometry,
          finalizingPresentationActive: false,
          lastScrollHeightChangeAt: now,
          sameHeightSampleCount: 0,
        },
      };
      pinCanvasToBottom("history-restore", "instant");
      return;
    }
    if (!wasFinalizing && isAssistantFinalizing) {
      scrollAuthorityRef.current = {
        ...scrollAuthorityRef.current,
        geometry: {
          ...scrollAuthorityRef.current.geometry,
          finalizingPresentationActive: true,
          lastScrollHeightChangeAt: now,
          sameHeightSampleCount: 0,
        },
      };
      pinCanvasToBottom("turn-settle", "instant");
      return;
    }
    if (isAssistantFinalizing) {
      scrollAuthorityRef.current = {
        ...scrollAuthorityRef.current,
        geometry: {
          ...scrollAuthorityRef.current.geometry,
          finalizingPresentationActive: true,
        },
      };
    }
  }, [isAssistantFinalizing, pinCanvasToBottom]);

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
    const applyAuthorityUserScroll = (
      partial: {
        deltaY?: number;
        explicitSource?: "wheel" | "key" | "touch" | "pointer";
      },
    ) => {
      const now = performance.now();
      const decision = reduceIntent(
        {
          ...scrollAuthorityRef.current,
          liveAutoFollowEnabled: liveAutoFollowEnabledRef.current,
        },
        {
          type: "user-scroll",
          deltaY: partial.deltaY,
          explicitSource: partial.explicitSource,
        },
        now,
      );
      scrollAuthorityRef.current = decision.state;
      if (decision.reasonCode === "forced-interrupted-by-user-scroll") {
        markUserScrollIntent();
        autoScrollRef.current = false;
        return;
      }
      if (decision.reasonCode === "forced-ignored-noise-scroll") {
        // forced 期内噪声：不解除 autoScroll、不 cancel（§3.4.1）
        return;
      }
      if (partial.deltaY !== undefined && partial.deltaY < 0) {
        markUserScrollIntent();
        autoScrollRef.current = false;
        return;
      }
      if (partial.explicitSource && partial.explicitSource !== "wheel") {
        markUserScrollIntent();
      }
    };
    const handleWheel = (event: WheelEvent) => {
      if (event.deltaY === 0) {
        return;
      }
      applyAuthorityUserScroll({
        deltaY: event.deltaY,
        explicitSource: "wheel",
      });
    };
    const handleTouchIntent = () => {
      applyAuthorityUserScroll({ explicitSource: "touch" });
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
      applyAuthorityUserScroll({ explicitSource: "pointer" });
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId === activePointerId) {
        applyAuthorityUserScroll({ explicitSource: "pointer" });
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
      applyAuthorityUserScroll({ explicitSource: "key" });
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
      const now = performance.now();
      const currentGeometry = readScrollGeometrySnapshot(container);
      const clampedScrollTop = resolveClampedScrollTop(
        scrollGeometrySnapshotRef.current,
        currentGeometry,
        PROGRAMMATIC_SCROLL_ECHO_TOLERANCE_PX,
      );
      if (clampedScrollTop !== null) {
        recordProgrammaticScrollEcho({
          recordedAt: now,
          scrollTop: clampedScrollTop,
          source: "clamp",
        });
      }
      scrollGeometrySnapshotRef.current = currentGeometry;

      const prevHeight = scrollAuthorityRef.current.geometry.lastScrollHeight;
      const geoDecision = reduceGeometry(
        {
          ...scrollAuthorityRef.current,
          liveAutoFollowEnabled: liveAutoFollowEnabledRef.current,
        },
        {
          kind:
            currentGeometry.maxScrollTop >
            Math.max(0, prevHeight - container.clientHeight)
              ? "content-grow"
              : currentGeometry.maxScrollTop <
                  Math.max(0, prevHeight - container.clientHeight)
                ? "content-shrink"
                : "measure-late",
          scrollHeight: container.scrollHeight,
          clientHeight: container.clientHeight,
          maxScrollTop: currentGeometry.maxScrollTop,
          scrollTop: container.scrollTop,
          phase: "static",
          scopeGeneration: scopeGenerationRef.current,
          finalizingPresentationActive: isAssistantFinalizingRef.current,
        },
        now,
      );
      scrollAuthorityRef.current = geoDecision.state;

      // forced 退役后同步 legacy autoScroll / deadline 语义
      if (
        geoDecision.reasonCode === "forced-retired-stable" ||
        geoDecision.reasonCode === "settle-timeout-short-of-bottom"
      ) {
        if (geoDecision.state.mode === "stick-bottom") {
          autoScrollRef.current = true;
        } else if (geoDecision.state.mode === "free") {
          // 跟随关：退役时已在真底或做过最后 pin；保持 autoScroll 与是否近底一致
          autoScrollRef.current = isNearBottom(container);
        }
        if (geoDecision.requestBottomPin) {
          // safety timeout 等：完整 pin，保证最终真底
          pinCanvasToBottom("history-restore", "instant");
        }
      }

      // 视口已在底且 autoScroll 武装：清掉过期 lease 竞态（fake timers 下
      // performance.now 与 Date 不同步会导致 wheel lease 假死），并 re-arm stick。
      if (
        autoScrollRef.current &&
        liveAutoFollowEnabledRef.current &&
        isNearBottom(container)
      ) {
        if (hasRecentUserScrollIntent()) {
          clearUserScrollIntent();
        }
        if (
          scrollAuthorityRef.current.mode === "free" ||
          scrollAuthorityRef.current.mode === "history-head"
        ) {
          const rearm = reduceIntent(
            {
              ...scrollAuthorityRef.current,
              liveAutoFollowEnabled: true,
            },
            { type: "focus-follow-on" },
            now,
          );
          scrollAuthorityRef.current = rearm.state;
        }
      }

      const mode = scrollAuthorityRef.current.mode;
      const authorityWantsPin =
        mode === "forced-bottom" ||
        mode === "stick-bottom" ||
        geoDecision.requestBottomPin ||
        (liveAutoFollowEnabledRef.current && autoScrollRef.current);

      if (autoScrollRef.current && authorityWantsPin && !hasRecentUserScrollIntent()) {
        // Resize 只「继续追」，不走完整 pin（避免 clearUserScrollIntent 吞用户上滚）
        continueBottomPinIfArmed();
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
    clearUserScrollIntent,
    continueBottomPinIfArmed,
    hasRecentUserScrollIntent,
    isNearBottom,
    liveAutoFollowEnabledRef,
    pinCanvasToBottom,
    recordCurrentScrollGeometry,
    recordProgrammaticScrollEcho,
    renderScopeKey,
  ]);
  const handleScrollControlRequest = useCallback(
    (edge: ConversationScrollEdge) => {
      if (edge === "bottom") {
        // 回到底部按钮：权威 pin 原语（smooth + 再入 forced 追迟到长高）
        pinCanvasToBottom("explicit", "smooth");
        return;
      }
      autoScrollRef.current = false;
      clearPendingJumpMessage();
      const now = performance.now();
      const decision = reduceIntent(
        {
          ...scrollAuthorityRef.current,
          liveAutoFollowEnabled: liveAutoFollowEnabledRef.current,
        },
        { type: "explicit-top" },
        now,
      );
      scrollAuthorityRef.current = decision.state;
      requestScrollConvergence("top", "smooth", "explicit-control");
    },
    [
      clearPendingJumpMessage,
      liveAutoFollowEnabledRef,
      pinCanvasToBottom,
      requestScrollConvergence,
    ],
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
