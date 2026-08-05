// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyUiScale,
  enqueueApplyUiScale,
  resetUiScaleNativePinForTests,
  usesCssPageZoom,
} from "./applyUiScale";
import type { RendererPlatform } from "./rendererPlatform";

function makeRoot(): HTMLElement {
  return document.createElement("div");
}

beforeEach(() => {
  resetUiScaleNativePinForTests();
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

describe("applyUiScale", () => {
  it("windows: CSS zoom at uiScale and native zoom pinned to 1 once", async () => {
    const root = makeRoot();
    const setNativeZoom = vi.fn(async () => undefined);
    await applyUiScale(1.1, {
      root,
      setNativeZoom,
      platform: "windows",
    });
    expect(root.style.zoom).toBe("1.1");
    expect(root.style.getPropertyValue("--ui-scale")).toBe("1.1");
    expect(setNativeZoom).toHaveBeenCalledTimes(1);
    expect(setNativeZoom).toHaveBeenCalledWith(1);

    await applyUiScale(0.8, {
      root,
      setNativeZoom,
      platform: "windows",
    });
    expect(root.style.zoom).toBe("0.8");
    // Second apply must not call setZoom again.
    expect(setNativeZoom).toHaveBeenCalledTimes(1);
  });

  it("enqueueApplyUiScale serializes and keeps latest scale", async () => {
    const root = makeRoot();
    const order: number[] = [];
    const setNativeZoom = vi.fn(async () => undefined);
    const slow = enqueueApplyUiScale(1.1, {
      root,
      setNativeZoom,
      platform: "windows",
    }).then(() => {
      order.push(1.1);
    });
    const fast = enqueueApplyUiScale(0.8, {
      root,
      setNativeZoom,
      platform: "windows",
    }).then(() => {
      order.push(0.8);
    });
    await Promise.all([slow, fast]);
    expect(root.style.zoom).toBe("0.8");
    expect(order[order.length - 1]).toBe(0.8);
  });

  it("macos: native zoom at uiScale and clears CSS zoom", async () => {
    const root = makeRoot();
    root.style.zoom = "1.2";
    const setNativeZoom = vi.fn(async () => undefined);
    await applyUiScale(0.8, {
      root,
      setNativeZoom,
      platform: "macos",
    });
    expect(root.style.zoom).toBe("");
    expect(root.style.getPropertyValue("--ui-scale")).toBe("0.8");
    expect(setNativeZoom).toHaveBeenCalledWith(0.8);
  });

  it("linux: same as macos (native uiScale)", async () => {
    const root = makeRoot();
    const setNativeZoom = vi.fn(async () => undefined);
    await applyUiScale(1.2, {
      root,
      setNativeZoom,
      platform: "linux",
    });
    expect(root.style.zoom).toBe("");
    expect(setNativeZoom).toHaveBeenCalledWith(1.2);
  });

  it("unknown: CSS zoom without requiring native API", async () => {
    const root = makeRoot();
    await applyUiScale(0.9, {
      root,
      platform: "unknown",
    });
    expect(root.style.zoom).toBe("0.9");
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
    expect(root.style.zoom).toBe("2.6");
    expect(setNativeZoom).toHaveBeenCalledWith(1);
  });
});
