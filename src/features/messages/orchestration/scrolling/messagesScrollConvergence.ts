export type ConversationScrollEdge = "top" | "bottom";
export type ConversationScrollMotion = "instant" | "smooth";

type ConversationScrollConvergenceOptions = {
  edge: ConversationScrollEdge;
  motion: ConversationScrollMotion;
  maxDurationMs?: number;
  settleFrames?: number;
  recheckDelaysMs?: readonly number[];
  shouldContinue?: () => boolean;
  onComplete?: (reason: "settled" | "timeout" | "cancelled") => void;
  /**
   * 每帧上报本帧读到的 scrollTop（写入前）与写入后的 scrollTop。调用方用它维护
   * 「程序化回声指纹」：WebKit 的 scroll 事件是异步派发的，钳位/收敛写入产生的
   * 事件可能在几何继续变化后才送达，只有指纹匹配才能与真实用户滚动区分开。
   */
  onFrameObservation?: (observedScrollTop: number, appliedScrollTop: number) => void;
};

const DEFAULT_MAX_DURATION_MS = 2_000;
const DEFAULT_SETTLE_FRAMES = 3;
const SCROLL_TOLERANCE_PX = 1;
const SMOOTH_MIN_STEP_PX = 24;
const SMOOTH_EASING_RATIO = 0.22;

export function resolveConversationScrollEdgeTarget(
  container: HTMLElement,
  edge: ConversationScrollEdge,
) {
  if (edge === "top") {
    return 0;
  }
  return Math.max(0, container.scrollHeight - container.clientHeight);
}

/**
 * 逐帧追踪可变的 scroll target。虚拟行测高和 content-visibility 可能在首次写入后
 * 继续改变 geometry，因此只有连续若干帧保持到位才算完成。
 */
export function startConversationScrollConvergence(
  container: HTMLElement,
  options: ConversationScrollConvergenceOptions,
): () => void {
  const maxDurationMs = options.maxDurationMs ?? DEFAULT_MAX_DURATION_MS;
  const settleFrameTarget = options.settleFrames ?? DEFAULT_SETTLE_FRAMES;
  let animationFrameId: number | null = null;
  const recheckTimerIds = new Set<number>();
  let cancelled = false;
  let completed = false;
  let lastCompletionReason: "settled" | "timeout" = "settled";

  const finish = (reason: "settled" | "timeout" | "cancelled") => {
    if (completed) {
      return;
    }
    completed = true;
    animationFrameId = null;
    options.onComplete?.(reason);
  };

  const clearPendingWork = () => {
    if (animationFrameId !== null) {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    recheckTimerIds.forEach((timerId) => window.clearTimeout(timerId));
    recheckTimerIds.clear();
  };

  const stopForInvalidGuard = () => {
    cancelled = true;
    clearPendingWork();
    finish("cancelled");
  };

  const startPulse = () => {
    if (cancelled || completed) {
      return;
    }
    if (options.shouldContinue && !options.shouldContinue()) {
      stopForInvalidGuard();
      return;
    }
    if (animationFrameId !== null) {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    const startedAt = performance.now();
    let settledFrames = 0;

    const step = () => {
      if (cancelled || completed) {
        return;
      }
      if (options.shouldContinue && !options.shouldContinue()) {
        stopForInvalidGuard();
        return;
      }

      const observedScrollTop = container.scrollTop;
      const target = resolveConversationScrollEdgeTarget(container, options.edge);
      const distance = target - observedScrollTop;
      const timedOut = performance.now() - startedAt >= maxDurationMs;

      if (Math.abs(distance) > SCROLL_TOLERANCE_PX && (timedOut || options.motion === "instant")) {
        container.scrollTop = target;
      } else if (Math.abs(distance) > SCROLL_TOLERANCE_PX) {
        const stepPx =
          Math.max(SMOOTH_MIN_STEP_PX, Math.abs(distance) * SMOOTH_EASING_RATIO) *
          Math.sign(distance);
        container.scrollTop += Math.abs(stepPx) > Math.abs(distance) ? distance : stepPx;
      }
      options.onFrameObservation?.(observedScrollTop, container.scrollTop);

      const remainingDistance =
        resolveConversationScrollEdgeTarget(container, options.edge) - container.scrollTop;
      settledFrames = Math.abs(remainingDistance) <= SCROLL_TOLERANCE_PX
        ? settledFrames + 1
        : 0;

      if (timedOut || settledFrames >= settleFrameTarget) {
        animationFrameId = null;
        lastCompletionReason = timedOut ? "timeout" : "settled";
        if (recheckTimerIds.size === 0) {
          finish(lastCompletionReason);
        }
        return;
      }
      animationFrameId = window.requestAnimationFrame(step);
    };

    // 首次同步落位，避免 history-open 在首帧留下可见的顶部闪烁；后续帧负责验证收敛。
    step();
  };

  for (const delayMs of [...new Set(options.recheckDelaysMs ?? [])].sort((a, b) => a - b)) {
    if (delayMs <= 0) {
      continue;
    }
    const timerId = window.setTimeout(() => {
      recheckTimerIds.delete(timerId);
      startPulse();
    }, delayMs);
    recheckTimerIds.add(timerId);
  }
  startPulse();

  return () => {
    cancelled = true;
    clearPendingWork();
  };
}
