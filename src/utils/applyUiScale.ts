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
 * docs/analysis/windows-ccgui-startup-hang-2026-08-05.md). CSS zoom carries
 * scale there; native zoom is pinned to 1 once per page session.
 *
 * macOS / Linux keep native setZoom(uiScale) (WKWebView / WebKitGTK).
 */
export function usesCssPageZoom(platform: RendererPlatform): boolean {
  return platform === "windows" || platform === "unknown";
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
    target.root.style.zoom = String(next);
    target.root.style.setProperty("--ui-scale", String(next));
    // Pin WebView2 ZoomFactor to 1 once so residual ≠1 from older builds is
    // cleared without calling setZoom on every scale change.
    if (target.setNativeZoom && !nativeIdentityPinned) {
      await target.setNativeZoom(1);
      nativeIdentityPinned = true;
    }
    return;
  }

  target.root.style.zoom = "";
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
