import {
  detectRendererPlatform,
  type RendererPlatform,
} from "./rendererPlatform";
import { clampUiScale } from "./uiScale";

export type ApplyUiScaleTarget = {
  root: HTMLElement;
  platform: RendererPlatform;
};

/**
 * Apply uiScale without native WebView zoom ≠1.
 *
 * Field evidence (Windows WebView2, 2026-08):
 * 1. setZoom(uiScale≠1) freezes the renderer (multi-GB).
 * 2. body { transform:scale + width/height:100/scale% } also freezes when
 *    combined with cold-start list hydration + early pointer input.
 *
 * Current strategy: CSS `zoom` only (layout-participating, no expanded
 * pre-transform surface). Production never calls native WebView zoom.
 *
 * Shell: html/body/#root/.app use a % height chain (base.css), not 100vh.
 */
export function usesCssPageZoom(_platform: RendererPlatform): boolean {
  return true;
}

/**
 * Transform layout-fill path is retired (WebView2 memory bomb).
 * Always null so callers clear width/height.
 *
 * @internal exported for unit tests
 */
export function cssZoomLayoutFillSize(scale: number): string | null {
  void clampUiScale(scale);
  return null;
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

/**
 * Cold-start CSS property writes on WebView2 (Chromium) trigger style recalc
 * + layout even when the value is unchanged — the engine must re-resolve the
 * cascade for every inline mutation.  On a 125%-DPI Windows machine the Blink
 * layout pass is heavier than WKWebView, and an unconditional 20-property
 * flush across <html> + <body> during the first effect after mount shifts the
 * layout tree just as React commits its initial paint, which starves the
 * compositor thread when a click arrives.
 *
 * Only touch properties that actually carry a residual value (hot-reload,
 * earlier non-identity scale, or stale transform fill from an older build).
 */
/** CSSOM property names (kebab-case) for residual scale styles. */
const ZOOM_FILL_CSS_PROPS = [
  "zoom",
  "transform",
  "transform-origin",
  "width",
  "height",
  "position",
  "top",
  "left",
  "right",
  "bottom",
] as const;

function clearResidualScaleStyles(el: HTMLElement): void {
  for (const prop of ZOOM_FILL_CSS_PROPS) {
    if (el.style.getPropertyValue(prop) !== "") {
      el.style.removeProperty(prop);
    }
  }
}

/**
 * CSS zoom only.  Strips only residual transform/fill; leaves already-clean
 * properties alone so cold-start first-paint does not invalidate layout.
 */
function setScaleLayoutStyles(el: HTMLElement, scale: number): void {
  clearResidualScaleStyles(el);

  if (scale === 1) {
    return;
  }

  el.style.setProperty("zoom", String(scale));
}

function clearScaleLayoutStyles(el: HTMLElement): void {
  clearResidualScaleStyles(el);
}

/**
 * CSS :root already declares --ui-scale: 1 (themes.dark.css:92).  Writing the
 * same value as an inline style shifts the cascade origin and forces Chromium
 * Blink to re-resolve every var(--ui-scale) consumer, invalidating the style
 * tree.  Only write --ui-scale for non-identity scales.
 */
function applyCssPageScaleStyles(root: HTMLElement, scale: number): void {
  if (scale !== 1) {
    root.style.setProperty("--ui-scale", String(scale));
  } else if (root.style.getPropertyValue("--ui-scale")) {
    // Clean up inline residue from a prior non-identity session (hot-reload,
    // startup guard recovery, etc.).
    root.style.removeProperty("--ui-scale");
  }

  const layout = resolveCssZoomLayoutTarget(root);
  if (layout !== root) {
    clearScaleLayoutStyles(root);
  }
  setScaleLayoutStyles(layout, scale);
}

/** @internal test helper */
export function resetApplyUiScaleQueueForTests(): void {
  applyQueue = Promise.resolve();
  applyGeneration = 0;
}

let applyQueue: Promise<void> = Promise.resolve();
let applyGeneration = 0;

/**
 * Serialise applies so rapid shortcut spam cannot reorder CSS writes.
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

  applyCssPageScaleStyles(target.root, next);
}

/** Convenience for production hook: detect platform and apply CSS-only zoom. */
export async function applyUiScaleToDocument(
  scale: number,
  options?: {
    root?: HTMLElement;
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
    platform: options?.platform ?? detectRendererPlatform(),
  };
  if (options?.enqueue === false) {
    await applyUiScale(scale, target);
    return;
  }
  await enqueueApplyUiScale(scale, target);
}
