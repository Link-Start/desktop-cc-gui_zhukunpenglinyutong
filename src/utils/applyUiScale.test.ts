// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyUiScale,
  cssZoomLayoutFillSize,
  enqueueApplyUiScale,
  resetUiScaleNativePinForTests,
  resolveCssZoomLayoutTarget,
  usesCssPageZoom,
} from "./applyUiScale";
import type { RendererPlatform } from "./rendererPlatform";

/** Detached div — layout styles land on the element itself (no document body hop). */
function makeRoot(): HTMLElement {
  return document.createElement("div");
}

function clearEl(el: HTMLElement): void {
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
  el.style.removeProperty("--ui-scale");
}

beforeEach(() => {
  resetUiScaleNativePinForTests();
  clearEl(document.documentElement);
  clearEl(document.body);
});

describe("usesCssPageZoom", () => {
  it.each<[RendererPlatform, boolean]>([
    ["windows", true],
    ["unknown", true],
    ["macos", false],
    ["linux", false],
  ])("platform %s → %s", (platform, expected) => {
    expect(usesCssPageZoom(platform)).toBe(expected);
  });
});

describe("cssZoomLayoutFillSize", () => {
  it("returns null at identity scale (caller clears layout)", () => {
    expect(cssZoomLayoutFillSize(1)).toBeNull();
  });

  it("expands layout by 1/scale for non-identity zoom", () => {
    expect(cssZoomLayoutFillSize(0.8)).toBe("125%");
    expect(cssZoomLayoutFillSize(1.25)).toBe("80%");
    // 100 / 1.1 ≈ 90.909...%
    expect(cssZoomLayoutFillSize(1.1)).toBe(`${100 / 1.1}%`);
  });

  it("clamps before computing fill", () => {
    // UI_SCALE_MIN = 0.8 → 125%
    expect(cssZoomLayoutFillSize(0.1)).toBe("125%");
  });
});

describe("resolveCssZoomLayoutTarget", () => {
  it("routes documentElement to body", () => {
    expect(resolveCssZoomLayoutTarget(document.documentElement)).toBe(
      document.body,
    );
  });

  it("keeps non-html roots (unit-test divs)", () => {
    const root = makeRoot();
    expect(resolveCssZoomLayoutTarget(root)).toBe(root);
  });
});

describe("applyUiScale", () => {
  it("windows: transform scale + layout fill, native zoom pinned to 1 once", async () => {
    const root = makeRoot();
    const setNativeZoom = vi.fn(async () => undefined);
    await applyUiScale(1.1, {
      root,
      setNativeZoom,
      platform: "windows",
    });
    expect(root.style.zoom).toBe("");
    expect(root.style.transform).toBe("scale(1.1)");
    expect(root.style.transformOrigin).toBe("0 0");
    expect(root.style.position).toBe("fixed");
    expect(root.style.top).toBe("0px");
    expect(root.style.left).toBe("0px");
    expect(root.style.width).toBe(`${100 / 1.1}%`);
    expect(root.style.height).toBe(`${100 / 1.1}%`);
    expect(root.style.getPropertyValue("--ui-scale")).toBe("1.1");
    expect(setNativeZoom).toHaveBeenCalledTimes(1);
    expect(setNativeZoom).toHaveBeenCalledWith(1);

    await applyUiScale(0.8, {
      root,
      setNativeZoom,
      platform: "windows",
    });
    expect(root.style.zoom).toBe("");
    expect(root.style.transform).toBe("scale(0.8)");
    expect(root.style.width).toBe("125%");
    expect(root.style.height).toBe("125%");
    // Second apply must not call setZoom again.
    expect(setNativeZoom).toHaveBeenCalledTimes(1);
  });

  it("windows documentElement: scales body and clears residual html zoom", async () => {
    document.documentElement.style.zoom = "0.8";
    document.documentElement.style.width = "125%";
    document.documentElement.style.height = "125%";

    await applyUiScale(0.8, {
      root: document.documentElement,
      platform: "windows",
    });

    expect(document.documentElement.style.zoom).toBe("");
    expect(document.documentElement.style.width).toBe("");
    expect(document.documentElement.style.height).toBe("");
    expect(document.documentElement.style.transform).toBe("");
    expect(document.documentElement.style.getPropertyValue("--ui-scale")).toBe(
      "0.8",
    );
    expect(document.body.style.zoom).toBe("");
    expect(document.body.style.transform).toBe("scale(0.8)");
    expect(document.body.style.width).toBe("125%");
    expect(document.body.style.height).toBe("125%");
    expect(document.body.style.position).toBe("fixed");
  });

  it("windows: scale 1 clears layout fill (no letterbox compensation)", async () => {
    const root = makeRoot();
    root.style.width = "125%";
    root.style.height = "125%";
    root.style.transform = "scale(0.8)";
    root.style.position = "fixed";
    await applyUiScale(1, {
      root,
      platform: "windows",
    });
    expect(root.style.zoom).toBe("");
    expect(root.style.transform).toBe("");
    expect(root.style.width).toBe("");
    expect(root.style.height).toBe("");
    expect(root.style.position).toBe("");
  });

  it("enqueueApplyUiScale serializes and keeps latest scale", async () => {
    const root = makeRoot();
    const order: number[] = [];
    const setNativeZoom = vi.fn(async (factor: number) => {
      order.push(factor);
      await new Promise((r) => setTimeout(r, 5));
    });
    const slow = enqueueApplyUiScale(1.2, {
      root,
      setNativeZoom,
      platform: "windows",
    });
    const fast = enqueueApplyUiScale(0.8, {
      root,
      setNativeZoom,
      platform: "windows",
    });
    await Promise.all([slow, fast]);
    expect(root.style.transform).toBe("scale(0.8)");
    expect(root.style.width).toBe("125%");
    expect(order[order.length - 1]).toBe(1);
  });

  it("macos: native zoom at uiScale and clears CSS scale + layout fill", async () => {
    const root = makeRoot();
    root.style.zoom = "1.2";
    root.style.width = "125%";
    root.style.height = "125%";
    root.style.transform = "scale(1.2)";
    root.style.position = "fixed";
    const setNativeZoom = vi.fn(async () => undefined);
    await applyUiScale(0.8, {
      root,
      setNativeZoom,
      platform: "macos",
    });
    expect(root.style.zoom).toBe("");
    expect(root.style.transform).toBe("");
    expect(root.style.width).toBe("");
    expect(root.style.height).toBe("");
    expect(root.style.position).toBe("");
    expect(root.style.getPropertyValue("--ui-scale")).toBe("0.8");
    expect(setNativeZoom).toHaveBeenCalledWith(0.8);
    expect(setNativeZoom).not.toHaveBeenCalledWith(1);
  });

  it("macos documentElement: clears body fill left by Windows path", async () => {
    document.body.style.zoom = "0.8";
    document.body.style.width = "125%";
    document.body.style.height = "125%";
    document.body.style.transform = "scale(0.8)";
    document.body.style.position = "fixed";
    const setNativeZoom = vi.fn(async () => undefined);
    await applyUiScale(1.1, {
      root: document.documentElement,
      setNativeZoom,
      platform: "macos",
    });
    expect(document.documentElement.style.zoom).toBe("");
    expect(document.body.style.zoom).toBe("");
    expect(document.body.style.transform).toBe("");
    expect(document.body.style.width).toBe("");
    expect(document.body.style.height).toBe("");
    expect(document.body.style.position).toBe("");
    expect(setNativeZoom).toHaveBeenCalledWith(1.1);
  });

  it("linux: same as macos (native uiScale, no CSS fill)", async () => {
    const root = makeRoot();
    root.style.width = "125%";
    root.style.height = "125%";
    root.style.transform = "scale(1.2)";
    const setNativeZoom = vi.fn(async () => undefined);
    await applyUiScale(1.2, {
      root,
      setNativeZoom,
      platform: "linux",
    });
    expect(root.style.zoom).toBe("");
    expect(root.style.transform).toBe("");
    expect(root.style.width).toBe("");
    expect(root.style.height).toBe("");
    expect(setNativeZoom).toHaveBeenCalledWith(1.2);
  });

  it("unknown: CSS scale + fill without requiring native API", async () => {
    const root = makeRoot();
    await applyUiScale(0.9, {
      root,
      platform: "unknown",
    });
    expect(root.style.zoom).toBe("");
    expect(root.style.transform).toBe("scale(0.9)");
    expect(root.style.width).toBe(`${100 / 0.9}%`);
    expect(root.style.height).toBe(`${100 / 0.9}%`);
  });

  it("clamps out-of-range scale before apply", async () => {
    const root = makeRoot();
    const setNativeZoom = vi.fn(async () => undefined);
    await applyUiScale(9, {
      root,
      setNativeZoom,
      platform: "windows",
    });
    // clampUiScale caps to UI_SCALE_MAX 2.6
    expect(root.style.transform).toBe("scale(2.6)");
    expect(root.style.width).toBe(`${100 / 2.6}%`);
    expect(setNativeZoom).toHaveBeenCalledWith(1);
  });
});
