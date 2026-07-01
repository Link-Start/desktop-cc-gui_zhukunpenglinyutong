// 运行时性能诊断开关(与 react-scan overlay 开关平级)。
//
// 背景:web-vitals 等基线诊断被 build-time PROD 门禁关死,而用户卡顿的正是打包版。
// 本控制器提供一个持久化的运行时开关(localStorage `ccgui.perf.diagnostics`),启停
// rAF 掉帧监视器、longtask 观测与最近交互跟踪。这些采集器底层用 appendRendererDiagnostic
// (无 build-time 门控),所以打包版同样可用。默认关闭,避免常态开销;用户在设置页打开
// 后即时生效。

import {
  installPerfInteractionTracking,
  uninstallPerfInteractionTracking,
} from "./perfContextBridge";
import {
  startFrameDropMonitor,
  startLongTaskObserver,
  stopFrameDropMonitor,
  stopLongTaskObserver,
} from "./frameDropMonitor";

const PERF_DIAGNOSTICS_FLAG_KEY = "ccgui.perf.diagnostics";

let running = false;

function canUseLocalStorage(): boolean {
  try {
    return (
      typeof globalThis !== "undefined" &&
      typeof globalThis.localStorage !== "undefined"
    );
  } catch {
    return false;
  }
}

/** 用户是否已打开性能诊断采集(持久化在 localStorage)。 */
export function isPerfDiagnosticsFlagEnabled(): boolean {
  if (!canUseLocalStorage()) {
    return false;
  }
  try {
    return globalThis.localStorage.getItem(PERF_DIAGNOSTICS_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

function persistFlag(enabled: boolean): void {
  if (!canUseLocalStorage()) {
    return;
  }
  try {
    if (enabled) {
      globalThis.localStorage.setItem(PERF_DIAGNOSTICS_FLAG_KEY, "1");
    } else {
      globalThis.localStorage.removeItem(PERF_DIAGNOSTICS_FLAG_KEY);
    }
  } catch {
    // localStorage 是尽力而为,忽略配额 / 权限失败。
  }
}

function startMonitors(): void {
  if (running) {
    return;
  }
  running = true;
  installPerfInteractionTracking();
  startFrameDropMonitor();
  startLongTaskObserver();
}

function stopMonitors(): void {
  if (!running) {
    return;
  }
  running = false;
  stopFrameDropMonitor();
  stopLongTaskObserver();
  uninstallPerfInteractionTracking();
}

/** 应用启动时调用:仅当持久化开关为开时启动采集。 */
export function startPerfDiagnosticsIfEnabled(): void {
  if (isPerfDiagnosticsFlagEnabled()) {
    startMonitors();
  }
}

/** 从设置页切换:持久化选择并即时启停采集。 */
export function setPerfDiagnosticsEnabled(enabled: boolean): void {
  persistFlag(enabled);
  if (enabled) {
    startMonitors();
  } else {
    stopMonitors();
  }
}

export function __resetPerfDiagnosticsControllerForTests(): void {
  stopMonitors();
}
