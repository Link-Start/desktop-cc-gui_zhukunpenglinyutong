import { memo, useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import ArrowUp from "lucide-react/dist/esm/icons/arrow-up";
import ArrowDown from "lucide-react/dist/esm/icons/arrow-down";

interface ScrollControlProps {
  containerRef: RefObject<HTMLDivElement | null>;
}

// 距底阈值(px)：小于此值视为「已在底部」，隐藏按钮。
const THRESHOLD = 100;
// 停止滚动后延迟隐藏的时间(ms)。
const HIDE_DELAY = 1500;
// 自驱动滚动的时间预算(ms)：超时直接落位，避免流式内容持续增高时无限追赶。
const SCROLL_ANIMATION_BUDGET_MS = 2000;
// 抵达目标后还需连续这么多帧目标不再变化，才认定「真的到位」。
const SCROLL_SETTLE_FRAMES = 3;
// 每帧至少推进的距离(px)，避免长距离收尾过慢。
const SCROLL_MIN_STEP_PX = 24;
// 每帧向剩余距离逼近的比例（指数缓动）。
const SCROLL_EASING_RATIO = 0.22;

type ScrollEdge = "top" | "bottom";

function resolveEdgeTarget(container: HTMLDivElement, edge: ScrollEdge): number {
  if (edge === "top") {
    return 0;
  }
  return Math.max(0, container.scrollHeight - container.clientHeight);
}

/**
 * 自驱动的平滑滚动，返回取消函数。
 *
 * 不能用 container.scrollTo({ behavior: "smooth" })：消息容器要么开着
 * @tanstack/react-virtual（滚动途中重测行高、写 scrollTop 做偏移修正），要么给离屏行加了
 * content-visibility:auto（靠近视口才真实布局）。前者直接取消原生 smooth 动画，后者让
 * 一次性算出的目标当场失效——表现都是「点一下只滚一段就停」。
 *
 * 所以这里每帧自己算目标、自己写 scrollTop：目标随 scrollHeight 实时重算，抵达后还要
 * 连续 SCROLL_SETTLE_FRAMES 帧目标不变才收工，超出时间预算则直接落位。
 */
function animateScrollToEdge(container: HTMLDivElement, edge: ScrollEdge): () => void {
  const startedAt = performance.now();
  let rafId = 0;
  let settledFrames = 0;
  let cancelled = false;

  function step() {
    if (cancelled) {
      return;
    }

    const target = resolveEdgeTarget(container, edge);
    const distance = target - container.scrollTop;
    const timedOut = performance.now() - startedAt > SCROLL_ANIMATION_BUDGET_MS;

    if (Math.abs(distance) <= 1) {
      container.scrollTop = target;
      settledFrames += 1;
      // 目标可能因新行渲染而继续变化，连续稳定若干帧才算真到位。
      if (settledFrames >= SCROLL_SETTLE_FRAMES || timedOut) {
        return;
      }
      rafId = requestAnimationFrame(step);
      return;
    }

    settledFrames = 0;
    if (timedOut) {
      container.scrollTop = target;
      return;
    }

    const stepPx =
      Math.max(SCROLL_MIN_STEP_PX, Math.abs(distance) * SCROLL_EASING_RATIO) *
      Math.sign(distance);
    container.scrollTop =
      container.scrollTop + (Math.abs(stepPx) > Math.abs(distance) ? distance : stepPx);
    rafId = requestAnimationFrame(step);
  }

  rafId = requestAnimationFrame(step);

  return () => {
    cancelled = true;
    cancelAnimationFrame(rafId);
  };
}

/**
 * ScrollControl —— 跟随滚轮方向出现的快捷滚动浮标（交互逻辑移植自
 * idea-claude-code-gui 的 ScrollControl）：
 * - 向上滚时显示「回到顶部」箭头，点击滚到顶部
 * - 向下滚时显示「回到底部」箭头，点击滚到底部
 * - 已在底部 / 内容不足一屏 / 停止滚动 1.5s 后自动隐藏
 *
 * 「显示」只由用户主动 wheel 触发，scroll 事件只负责「到底了就藏起来」——
 * 这样程序化的自动跟随滚动不会误触发浮标。
 *
 * 滚到底后 scroll 事件会让 Messages 的 updateAutoScroll 重新武装底部跟随；
 * 滚到顶则自然解除跟随，无需额外协调。
 *
 * ponytail: 定位从原项目的 position:fixed + inputAreaRef + getAppViewport()
 * zoom 补偿，简化为相对 .messages-shell(已 position:relative) 的 absolute 固定
 * 右下角。原方案是 IntelliJ JCEF 的 CSS zoom 专用补偿，Tauri 无此问题；且本
 * 项目输入框不在 Messages 组件内，拿不到 inputAreaRef。
 *
 * 性能：本地 state（不进根渲染链），scroll/wheel 均 passive + rAF 节流，
 * setVisible 同值时 React 自动 bail，符合仓库性能红线。
 */
export const ScrollControl = memo(({ containerRef }: ScrollControlProps) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [direction, setDirection] = useState<"up" | "down">("down");
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelScrollAnimationRef = useRef<(() => void) | null>(null);

  const cancelScrollAnimation = useCallback(() => {
    cancelScrollAnimationRef.current?.();
    cancelScrollAnimationRef.current = null;
  }, []);

  // 检查滚动位置：内容不足一屏或已在底部时隐藏。仅隐藏、从不主动显示。
  const checkScrollPosition = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    if (scrollHeight <= clientHeight) {
      setVisible(false);
      return;
    }

    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    if (distanceFromBottom < THRESHOLD) {
      setVisible(false);
    }
  }, [containerRef]);

  // 滚轮事件是唯一「显示」入口：据 deltaY 定方向并起隐藏计时器。
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      const container = containerRef.current;
      if (!container) return;

      // 用户重新接管滚动，放弃正在进行的程序化滚动。
      cancelScrollAnimation();

      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight <= clientHeight) return;

      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      if (distanceFromBottom < THRESHOLD) {
        setVisible(false);
        return;
      }

      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }

      // deltaY > 0 向下滚 → 回底箭头；deltaY < 0 向上滚 → 回顶箭头。
      if (e.deltaY > 0) {
        setDirection("down");
      } else if (e.deltaY < 0) {
        setDirection("up");
      }

      setVisible(true);
      hideTimerRef.current = setTimeout(() => setVisible(false), HIDE_DELAY);
    },
    [cancelScrollAnimation, containerRef],
  );

  const handleClick = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    cancelScrollAnimation();
    cancelScrollAnimationRef.current = animateScrollToEdge(
      container,
      direction === "up" ? "top" : "bottom",
    );
    setVisible(false);
  }, [cancelScrollAnimation, containerRef, direction]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    checkScrollPosition();

    // scroll 监听经 rAF 节流，passive 不阻塞滚动。
    let scrollRafId: number | null = null;
    const handleScroll = () => {
      if (scrollRafId !== null) return;
      scrollRafId = requestAnimationFrame(() => {
        scrollRafId = null;
        checkScrollPosition();
      });
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    container.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("resize", checkScrollPosition);

    return () => {
      container.removeEventListener("scroll", handleScroll);
      container.removeEventListener("wheel", handleWheel);
      window.removeEventListener("resize", checkScrollPosition);
      if (scrollRafId !== null) cancelAnimationFrame(scrollRafId);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      cancelScrollAnimation();
    };
  }, [cancelScrollAnimation, checkScrollPosition, containerRef, handleWheel]);

  if (!visible) return null;

  const label =
    direction === "up" ? t("messages.backToTop") : t("messages.backToBottom");

  return (
    <button
      type="button"
      className="scroll-control-button"
      onClick={handleClick}
      aria-label={label}
      title={label}
      data-testid="messages-scroll-control"
    >
      {direction === "up" ? (
        <ArrowUp size={17} aria-hidden />
      ) : (
        <ArrowDown size={17} aria-hidden />
      )}
    </button>
  );
});

ScrollControl.displayName = "ScrollControl";
