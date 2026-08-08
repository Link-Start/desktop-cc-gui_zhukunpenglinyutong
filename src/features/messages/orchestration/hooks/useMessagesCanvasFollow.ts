/**
 * 幕布跟随 —— 对齐 jetbrains-cc-gui `useScrollBehavior`（P0 砍分叉后）。
 *
 * 只保留 jetbrains 三 ref + wheel + 在底一直跟：
 * - userPaused / isUserAtBottom / isAutoScrolling
 * - wheel 上滚暂停；下滚回阈值恢复
 * - scroll 未暂停时按距底同步 isUserAtBottom（无假离底几何保护）
 * - 在底且未暂停：followSignal / RO / live text → scrollTop = scrollHeight
 * - 发送 / 打开历史 / 回底：resumeFollowAndPin
 * - 换会话：默认武装贴底（isUserAtBottom=true），内容就绪再 pin（history-open）
 *
 * 故意不做：scrollIntoView、liveAutoFollow 门闩、FORCE 超时、假离底 lastScroll 栈
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type MutableRefObject,
} from "react";
import { subscribeLiveAssistantText } from "../../../threads/utils/liveAssistantTextChannel";

/** 距底阈值(px)。与 jetbrains BOTTOM_THRESHOLD_PX=100 一致。 */
export const CANVAS_BOTTOM_THRESHOLD_PX = 100;

const SCROLL_ANCHOR_ENABLED_CLASS = "scroll-anchor-enabled";

export function isCanvasNearBottom(
  container: Pick<HTMLDivElement, "scrollHeight" | "scrollTop" | "clientHeight">,
): boolean {
  return (
    container.scrollHeight - container.scrollTop - container.clientHeight <
    CANVAS_BOTTOM_THRESHOLD_PX
  );
}

type UseMessagesCanvasFollowInput = {
  followSignal: unknown;
  isThinking: boolean;
  /** 有 pending jump 时换会话不武装 stick，避免 RO/follow 抢在锚点跳转前钉底。 */
  hasPendingJump?: boolean;
  /**
   * 产品「焦点跟随」：仅卡住 continuous stick（layout/RO/channel）。
   * 发送 / history-open / ScrollControl 的 resumeFollowAndPin 不受影响。
   */
  liveAutoFollowEnabledRef: MutableRefObject<boolean>;
  renderScopeKey: string;
  threadId: string | null;
};

export function useMessagesCanvasFollow({
  followSignal,
  isThinking,
  hasPendingJump = false,
  liveAutoFollowEnabledRef,
  renderScopeKey,
  threadId,
}: UseMessagesCanvasFollowInput) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const isUserAtBottomRef = useRef(true);
  const isAutoScrollingRef = useRef(false);
  const userPausedRef = useRef(false);
  const pinRafRef = useRef<number | null>(null);
  const wheelRafRef = useRef<number | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const autoScrollClearRafRef = useRef<number | null>(null);

  const syncScrollAnchoring = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const shouldEnable = userPausedRef.current || !isUserAtBottomRef.current;
    container.classList.toggle(SCROLL_ANCHOR_ENABLED_CLASS, shouldEnable);
  }, []);

  const syncUserAtBottomState = useCallback(
    (container: HTMLDivElement) => {
      // jetbrains：未暂停时 scroll 直接按距底重算，无高度阶跃保护。
      isUserAtBottomRef.current = isCanvasNearBottom(container);
      syncScrollAnchoring();
    },
    [syncScrollAnchoring],
  );

  const pauseFollow = useCallback(() => {
    userPausedRef.current = true;
    isUserAtBottomRef.current = false;
    syncScrollAnchoring();
  }, [syncScrollAnchoring]);

  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    isAutoScrollingRef.current = true;
    isUserAtBottomRef.current = true;
    container.classList.remove(SCROLL_ANCHOR_ENABLED_CLASS);

    void container.scrollHeight;
    const endElement = messagesEndRef.current;
    if (endElement) {
      void endElement.offsetTop;
    }

    container.scrollTop = container.scrollHeight;

    if (autoScrollClearRafRef.current !== null) {
      cancelAnimationFrame(autoScrollClearRafRef.current);
    }
    autoScrollClearRafRef.current = requestAnimationFrame(() => {
      autoScrollClearRafRef.current = null;
      isAutoScrollingRef.current = false;
    });
  }, []);

  /** continuous stick：焦点跟随开 + 在底未暂停。同步钉 + rAF 补一帧真高。 */
  const pinIfFollowing = useCallback(() => {
    if (!containerRef.current) {
      return;
    }
    if (!liveAutoFollowEnabledRef.current) {
      return;
    }
    if (userPausedRef.current || !isUserAtBottomRef.current) {
      return;
    }
    if (pinRafRef.current !== null) {
      return;
    }
    scrollToBottom();
    pinRafRef.current = requestAnimationFrame(() => {
      pinRafRef.current = null;
      if (
        !liveAutoFollowEnabledRef.current ||
        userPausedRef.current ||
        !isUserAtBottomRef.current
      ) {
        return;
      }
      scrollToBottom();
    });
  }, [liveAutoFollowEnabledRef, scrollToBottom]);

  const resumeFollowAndPin = useCallback(() => {
    userPausedRef.current = false;
    isUserAtBottomRef.current = true;
    scrollToBottom();
    // layout 后再补一帧真高（气泡/MD 同 commit 后测高）。
    requestAnimationFrame(() => {
      if (!userPausedRef.current) {
        scrollToBottom();
      }
    });
    syncScrollAnchoring();
  }, [scrollToBottom, syncScrollAnchoring]);

  const settleFollow = useCallback(() => {
    if (userPausedRef.current) {
      return;
    }
    resumeFollowAndPin();
  }, [resumeFollowAndPin]);

  // 换会话：默认武装贴底；若本帧已有 pending jump 则暂停 stick（跳锚优先）。
  useLayoutEffect(() => {
    if (hasPendingJump) {
      userPausedRef.current = true;
      isUserAtBottomRef.current = false;
    } else {
      userPausedRef.current = false;
      isUserAtBottomRef.current = true;
    }
    isAutoScrollingRef.current = false;
    if (pinRafRef.current !== null) {
      cancelAnimationFrame(pinRafRef.current);
      pinRafRef.current = null;
    }
    if (autoScrollClearRafRef.current !== null) {
      cancelAnimationFrame(autoScrollClearRafRef.current);
      autoScrollClearRafRef.current = null;
    }
  }, [hasPendingJump, renderScopeKey]);

  // jetbrains：layout 阶段钉底（paint 前）。受焦点跟随开关约束（发送/open 走 resume）。
  useLayoutEffect(() => {
    void followSignal;
    void isThinking;
    syncScrollAnchoring();
    if (!liveAutoFollowEnabledRef.current) {
      return;
    }
    if (userPausedRef.current || !isUserAtBottomRef.current) {
      return;
    }
    scrollToBottom();
  }, [
    followSignal,
    isThinking,
    liveAutoFollowEnabledRef,
    scrollToBottom,
    syncScrollAnchoring,
  ]);

  useEffect(() => {
    if (!threadId || !isThinking) {
      return undefined;
    }
    return subscribeLiveAssistantText(threadId, () => {
      pinIfFollowing();
    });
  }, [isThinking, pinIfFollowing, threadId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    syncScrollAnchoring();

    const handleScroll = () => {
      if (scrollRafRef.current !== null) {
        return;
      }
      scrollRafRef.current = requestAnimationFrame(() => {
        scrollRafRef.current = null;
        if (isAutoScrollingRef.current) {
          return;
        }
        if (userPausedRef.current) {
          return;
        }
        syncUserAtBottomState(container);
      });
    };

    const handleWheel = (event: WheelEvent) => {
      if (event.deltaY < 0) {
        userPausedRef.current = true;
        isUserAtBottomRef.current = false;
        syncScrollAnchoring();
        return;
      }
      if (event.deltaY > 0) {
        if (wheelRafRef.current !== null) {
          cancelAnimationFrame(wheelRafRef.current);
        }
        wheelRafRef.current = requestAnimationFrame(() => {
          wheelRafRef.current = null;
          if (isCanvasNearBottom(container)) {
            userPausedRef.current = false;
            isUserAtBottomRef.current = true;
          }
          syncScrollAnchoring();
        });
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    container.addEventListener("wheel", handleWheel, { passive: true });

    const resolveObservedContent = (): HTMLElement | null => {
      const endParent = messagesEndRef.current?.parentElement;
      if (endParent instanceof HTMLElement && endParent !== container) {
        return endParent;
      }
      const timelineRoot = container.querySelector<HTMLElement>(".messages-timeline-root");
      if (timelineRoot) {
        return timelineRoot;
      }
      const first = container.firstElementChild;
      return first instanceof HTMLElement ? first : null;
    };

    if (typeof ResizeObserver === "undefined") {
      return () => {
        container.removeEventListener("scroll", handleScroll);
        container.removeEventListener("wheel", handleWheel);
        container.classList.remove(SCROLL_ANCHOR_ENABLED_CLASS);
      };
    }

    // RO 在布局之后触发：同步钉底（不再额外 rAF 拖一帧）。
    const observer = new ResizeObserver(() => {
      if (userPausedRef.current) {
        syncScrollAnchoring();
        return;
      }
      if (!liveAutoFollowEnabledRef.current) {
        return;
      }
      if (isUserAtBottomRef.current) {
        scrollToBottom();
        return;
      }
      syncUserAtBottomState(container);
    });

    observer.observe(container);
    const content = resolveObservedContent();
    if (content) {
      observer.observe(content);
    }

    return () => {
      observer.disconnect();
      container.removeEventListener("scroll", handleScroll);
      container.removeEventListener("wheel", handleWheel);
      container.classList.remove(SCROLL_ANCHOR_ENABLED_CLASS);
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
      if (wheelRafRef.current !== null) {
        cancelAnimationFrame(wheelRafRef.current);
        wheelRafRef.current = null;
      }
      if (pinRafRef.current !== null) {
        cancelAnimationFrame(pinRafRef.current);
        pinRafRef.current = null;
      }
      if (autoScrollClearRafRef.current !== null) {
        cancelAnimationFrame(autoScrollClearRafRef.current);
        autoScrollClearRafRef.current = null;
      }
    };
  }, [
    liveAutoFollowEnabledRef,
    renderScopeKey,
    scrollToBottom,
    syncScrollAnchoring,
    syncUserAtBottomState,
  ]);

  const getPendingScrollResourceCount = useCallback(
    () => (pinRafRef.current !== null ? 1 : 0),
    [],
  );

  return {
    containerRef,
    getPendingScrollResourceCount,
    isUserAtBottomRef,
    messagesEndRef,
    pauseFollow,
    pinIfFollowing,
    resumeFollowAndPin,
    scrollToBottom,
    settleFollow,
    userPausedRef,
  };
}
