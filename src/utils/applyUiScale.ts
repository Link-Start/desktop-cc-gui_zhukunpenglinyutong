import {
  detectRendererPlatform,
  type RendererPlatform,
} from "./rendererPlatform";
import { clampUiScale } from "./uiScale";

export type ApplyUiScaleTarget = {
  root: HTMLElement;
  setNativeZoom?: (factor: number) => Promise<void>;
  platform: RendererPlatform;
};

/**
 * Windows WebView2 SetZoomFactor(≠1) can freeze the renderer (see
 * docs/analysis/windows-ccgui-startup-hang-2026-08-05.md). CSS page scale
 * carries uiScale there; native zoom is pinned to 1 once per page session.
 *
 * Why not CSS `zoom` for fill:
 * WebView2 has been observed to honor layout `width/height: 100/scale%` while
 * `zoom` does not re-expand the border box back to the viewport — result is a
 * permanently letterboxed shell (e.g. uiScale 1.3 → ~77% content, black bars).
 * `transform: scale()` always scales paint, including backgrounds / chrome.
 *
 * Target is <body> when `root` is <html>:
 * - position:fixed + top/left 0 so % sizes resolve against the viewport
 * - width/height = 100/scale % (layout box)
 * - transform: scale(scale) + origin 0 0 → visual box fills the window
 * - portals mounted on body (dialogs, menus) scale with the shell
 *
 * Shell children must size with a % chain under body (see base.css
 * html/body/#root/.app). 100vh/100vw ignore parent expansion.
 *
 * macOS / Linux keep native setZoom(uiScale) (WKWebView / WebKitGTK) and never
 * keep CSS scale layout compensation.
 */
export function usesCssPageZoom(platform: RendererPlatform): boolean {
  return platform === "windows" || platform === "unknown";
}

/**
 * Layout size so `transform: scale(s)` still fills the viewport.
 * Returns null when scale is 1 (caller must clear width/height).
 *
 * @internal exported for unit tests
 */
export function cssZoomLayoutFillSize(scale: number): string | null {
  const next = clampUiScale(scale);
  if (next === 1) {
    return null;
  }
  return `${100 / next}%`;
}

/**
 * Prefer <body> when root is <html>; keep detached test roots as-is.
 *
 * @internal exported for unit tests
 */
export function resolveCssZoomLayoutTarget(root: HTMLElement): HTMLElement {
  const doc = root.ownerDocument;
  if (doc?.documentElement === root && doc.body) {
    return doc.body;
  }
  return root;
}

function setScaleLayoutStyles(el: HTMLElement, scale: number): void {
  // Drop any residual CSS zoom from older builds — never combine with transform.
  el.style.zoom = "";

  const fill = cssZoomLayoutFillSize(scale);
  if (fill === null) {
    el.style.transform = "";
    el.style.transformOrigin = "";
    el.style.width = "";
    el.style.height = "";
    el.style.position = "";
    el.style.top = "";
    el.style.left = "";
    el.style.right = "";
    el.style.bottom = "";
    return;
  }

  // Fixed against the viewport so % is not clipped by a pre-transform parent box.
  el.style.position = "fixed";
  el.style.top = "0px";
  el.style.left = "0px";
  el.style.right = "auto";
  el.style.bottom = "auto";
  el.style.width = fill;
  el.style.height = fill;
  el.style.transformOrigin = "0 0";
  el.style.transform = `scale(${scale})`;
}

function clearScaleLayoutStyles(el: HTMLElement): void {
  el.style.zoom = "";
  el.style.transform = "";
  el.style.transformOrigin = "";
  el.style.width = "";
  el.style.height = "";
  el.style.position = "";
  el.style.top = "";
  el.style.left = "";
  el.style.right = "";
  el.style.bottom = "";
}

function applyCssPageScaleStyles(root: HTMLElement, scale: number): void {
  root.style.setProperty("--ui-scale", String(scale));

  const layout = resolveCssZoomLayoutTarget(root);
  // Older builds zoomed <html>; clear residual so we never double-scale.
  if (layout !== root) {
    clearScaleLayoutStyles(root);
  }
  setScaleLayoutStyles(layout, scale);
}

/** Clear CSS scale + letterbox compensation (native path / scale reset). */
function clearCssPageScaleStyles(root: HTMLElement): void {
  clearScaleLayoutStyles(root);
  const layout = resolveCssZoomLayoutTarget(root);
  if (layout !== root) {
    clearScaleLayoutStyles(layout);
  }
  root.style.removeProperty("--ui-scale");
  if (layout !== root) {
    layout.style.removeProperty("--ui-scale");
  }
}

/** After first successful pin to 1, skip further setZoom(1) on CSS platforms. */
let nativeIdentityPinned = false;

/** @internal test helper */
export function resetUiScaleNativePinForTests(): void {
  nativeIdentityPinned = false;
  applyQueue = Promise.resolve();
  applyGeneration = 0;
}

let applyQueue: Promise<void> = Promise.resolve();
let applyGeneration = 0;

/**
 * Serialise applies so rapid shortcut spam cannot reorder CSS/native writes.
 * Stale generations are skipped after they reach the head of the queue.
 */
export function enqueueApplyUiScale(
  scale: number,
  target: ApplyUiScaleTarget,
): Promise<void> {
  const generation = ++applyGeneration;
  const run = async () => {
    if (generation !== applyGeneration) {
      return;
    }
    await applyUiScale(scale, target);
  };
  applyQueue = applyQueue.then(run, run);
  return applyQueue;
}

export async function applyUiScale(
  scale: number,
  target: ApplyUiScaleTarget,
): Promise<void> {
  const next = clampUiScale(scale);

  if (usesCssPageZoom(target.platform)) {
    applyCssPageScaleStyles(target.root, next);
    // Pin WebView2 ZoomFactor to 1 once so residual ≠1 from older builds is
    // cleared without calling setZoom on every scale change.
    if (target.setNativeZoom && !nativeIdentityPinned) {
      await target.setNativeZoom(1);
      nativeIdentityPinned = true;
    }
    return;
  }

  // macOS / Linux: native zoom only. Strip any CSS scale compensation so a
  // mistaken residual (or platform switch in tests) cannot letterbox Mac/Linux.
  clearCssPageScaleStyles(target.root);
  target.root.style.setProperty("--ui-scale", String(next));
  if (target.setNativeZoom) {
    await target.setNativeZoom(next);
  }
}

/** Convenience for production hook: detect platform + optional native zoom. */
export async function applyUiScaleToDocument(
  scale: number,
  options?: {
    root?: HTMLElement;
    setNativeZoom?: (factor: number) => Promise<void>;
    platform?: RendererPlatform;
    /** default true — use serial queue */
    enqueue?: boolean;
  },
): Promise<void> {
  const root = options?.root ?? globalThis.document?.documentElement;
  if (!root) {
    return;
  }
  const target: ApplyUiScaleTarget = {
    root,
    setNativeZoom: options?.setNativeZoom,
    platform: options?.platform ?? detectRendererPlatform(),
  };
  if (options?.enqueue === false) {
    await applyUiScale(scale, target);
    return;
  }
  await enqueueApplyUiScale(scale, target);
}
