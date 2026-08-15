/**
 * Cold-start: the first message render lazily imports FullMarkdownRuntime
 * (react-markdown full parse stack, ~591KB vendor-markdown chunk) right on the
 * user's first-click path — the field repro is a stall when the first click
 * after startup-gate-ready opens a thread and WebView2 compiles the chunk
 * inline. Warm the chunk during browser idle as soon as the gate opens so the
 * lazy import in Markdown.tsx hits the module cache instead of compiling on
 * the click path.
 */

import { subscribeStartupGateReady } from "../features/startup-orchestration/utils/startupGateReady";
import { scheduleWhenBrowserIdle } from "../utils/interactiveMainThread";

let prewarmArmed = false;
let prewarmFireCount = 0;

/** @internal test observation: how many times the warm import was triggered. */
export function getFullMarkdownRuntimePrewarmFireCountForTests(): number {
  return prewarmFireCount;
}

function isTestMode(): boolean {
  try {
    return import.meta.env.MODE === "test";
  } catch {
    return false;
  }
}

/** Idle-import the exact lazy chunk Markdown.tsx uses (module cache → no-op). */
function warmFullMarkdownRuntimeChunk(): void {
  prewarmFireCount += 1;
  // Keep the specifier aligned with Markdown.tsx lazy() so both share the
  // same chunk / module cache entry.
  void import("./runtime/FullMarkdownRuntime");
}

/**
 * Arm the one-shot idle prewarm. Fires after startup-gate-ready (or
 * immediately when armed after the gate already opened). No-op in tests and
 * on repeat calls. Returns a disposer suitable for useEffect cleanup.
 */
export function scheduleFullMarkdownRuntimePrewarm(options?: {
  /** Test-only escape hatch; production callers never pass this. */
  allowInTest?: boolean;
}): () => void {
  if (prewarmArmed || (isTestMode() && !options?.allowInTest)) {
    return () => {};
  }
  prewarmArmed = true;
  let cancelIdle: (() => void) | null = null;
  const unsubscribe = subscribeStartupGateReady(() => {
    if (cancelIdle) {
      return;
    }
    cancelIdle = scheduleWhenBrowserIdle(warmFullMarkdownRuntimeChunk, {
      timeoutMs: 5_000,
    });
  });
  return () => {
    unsubscribe();
    cancelIdle?.();
    cancelIdle = null;
  };
}

/** @internal */
export function resetFullMarkdownRuntimePrewarmForTests(): void {
  prewarmArmed = false;
  prewarmFireCount = 0;
}
