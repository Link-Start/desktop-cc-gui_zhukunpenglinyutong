/* @vitest-environment jsdom */
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUiScaleShortcuts } from "./useUiScaleShortcuts";
import type { AppSettings } from "../../../types";
import type { RendererPlatform } from "../../../utils/rendererPlatform";
import { resetUiScaleNativePinForTests } from "../../../utils/applyUiScale";

const webviewMocks = vi.hoisted(() => ({
  getCurrentWebview: vi.fn(),
  setZoom: vi.fn(async () => undefined),
}));

const platformMocks = vi.hoisted(() => ({
  platform: "macos" as RendererPlatform,
}));

vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: webviewMocks.getCurrentWebview,
}));

vi.mock("../../../utils/rendererPlatform", async () => {
  const actual = await vi.importActual<
    typeof import("../../../utils/rendererPlatform")
  >("../../../utils/rendererPlatform");
  return {
    ...actual,
    detectRendererPlatform: () => platformMocks.platform,
  };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function createSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    uiScale: 1,
    increaseUiScaleShortcut: "Mod+=",
    decreaseUiScaleShortcut: "Mod+-",
    resetUiScaleShortcut: "Mod+0",
    ...overrides,
  } as AppSettings;
}

describe("useUiScaleShortcuts", () => {
  beforeEach(() => {
    resetUiScaleNativePinForTests();
    platformMocks.platform = "macos";
    document.documentElement.style.zoom = "";
    document.documentElement.style.width = "";
    document.documentElement.style.height = "";
    document.documentElement.style.removeProperty("--ui-scale");
    document.body.style.zoom = "";
    document.body.style.width = "";
    document.body.style.height = "";
    webviewMocks.setZoom.mockReset();
    webviewMocks.setZoom.mockResolvedValue(undefined);
    webviewMocks.getCurrentWebview.mockReset();
    webviewMocks.getCurrentWebview.mockReturnValue({
      setZoom: webviewMocks.setZoom,
    });
  });

  it("macos: applies native zoom at uiScale and strips CSS layout fill", async () => {
    platformMocks.platform = "macos";
    document.documentElement.style.zoom = "0.8";
    document.documentElement.style.width = "125%";
    document.documentElement.style.height = "125%";
    document.body.style.zoom = "0.8";
    document.body.style.width = "125%";
    document.body.style.height = "125%";
    const settings = createSettings({ uiScale: 1.1 });
    renderHook(() =>
      useUiScaleShortcuts({
        settings,
        setSettings: vi.fn(),
        saveSettings: vi.fn(async (next) => next),
      }),
    );

    await waitFor(() => {
      expect(webviewMocks.setZoom).toHaveBeenCalledWith(1.1);
    });
    expect(document.documentElement.style.zoom).toBe("");
    expect(document.documentElement.style.width).toBe("");
    expect(document.documentElement.style.height).toBe("");
    expect(document.body.style.zoom).toBe("");
    expect(document.body.style.width).toBe("");
    expect(document.body.style.height).toBe("");
  });

  it("linux: applies native zoom at uiScale (same as macos)", async () => {
    platformMocks.platform = "linux";
    renderHook(() =>
      useUiScaleShortcuts({
        settings: createSettings({ uiScale: 0.8 }),
        setSettings: vi.fn(),
        saveSettings: vi.fn(async (next) => next),
      }),
    );

    await waitFor(() => {
      expect(webviewMocks.setZoom).toHaveBeenCalledWith(0.8);
    });
  });

  it("windows: transform scale + layout fill on body and native zoom pinned to 1", async () => {
    platformMocks.platform = "windows";
    renderHook(() =>
      useUiScaleShortcuts({
        settings: createSettings({ uiScale: 0.8 }),
        setSettings: vi.fn(),
        saveSettings: vi.fn(async (next) => next),
      }),
    );

    await waitFor(() => {
      // Scale lives on <body> via transform; <html> stays viewport-sized.
      expect(document.documentElement.style.zoom).toBe("");
      expect(document.documentElement.style.transform).toBe("");
      expect(document.body.style.zoom).toBe("");
      expect(document.body.style.transform).toBe("scale(0.8)");
      expect(document.body.style.width).toBe("125%");
      expect(document.body.style.height).toBe("125%");
      expect(document.body.style.position).toBe("fixed");
      expect(webviewMocks.setZoom).toHaveBeenCalledWith(1);
    });
    expect(webviewMocks.setZoom).not.toHaveBeenCalledWith(0.8);
  });

  it("survives missing Tauri window metadata in browser previews", async () => {
    platformMocks.platform = "unknown";
    webviewMocks.getCurrentWebview.mockImplementation(() => {
      throw new TypeError(
        "Cannot read properties of undefined (reading 'metadata')",
      );
    });

    expect(() =>
      renderHook(() =>
        useUiScaleShortcuts({
          settings: createSettings({ uiScale: 0.9 }),
          setSettings: vi.fn(),
          saveSettings: vi.fn(async (next) => next),
        }),
      ),
    ).not.toThrow();

    await waitFor(() => {
      expect(document.body.style.transform).toBe("scale(0.9)");
    });
  });
});
