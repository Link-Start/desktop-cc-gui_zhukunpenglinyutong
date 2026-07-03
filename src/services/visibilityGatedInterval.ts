/**
 * setInterval 的可见性门控封装：document 隐藏时暂停周期回调，恢复可见时先立即
 * 补一次 tick 再恢复周期，调用方语义上等价于"始终最新"，但后台窗口不再持续
 * 消耗主线程。常驻轮询（IPC 快照、store 刷新）应一律走这里——历史上多个
 * 2s/5s 轮询在窗口后台时叠加，是"空闲也卡顿"的来源之一。
 *
 * 初始 tick 由调用方自行决定（多数调用点在启动时已各自先调一次）。
 */
export function setVisibilityGatedInterval(
  tick: () => void,
  intervalMs: number,
): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  let intervalHandle: number | null = null;

  const start = () => {
    if (intervalHandle === null) {
      intervalHandle = window.setInterval(tick, intervalMs);
    }
  };
  const stop = () => {
    if (intervalHandle !== null) {
      window.clearInterval(intervalHandle);
      intervalHandle = null;
    }
  };
  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      stop();
      return;
    }
    tick();
    start();
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  if (document.visibilityState !== "hidden") {
    start();
  }

  return () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    stop();
  };
}
