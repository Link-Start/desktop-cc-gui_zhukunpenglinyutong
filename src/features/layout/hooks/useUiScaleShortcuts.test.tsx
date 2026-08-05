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
    document.documentElement.style.removeProperty("--ui-scale");
    webviewMocks.setZoom.mockReset();
    webviewMocks.setZoom.mockResolvedValue(undefined);
    webviewMocks.getCurrentWebview.mockReset();
    webviewMocks.getCurrentWebview.mockReturnValue({
      setZoom: webviewMocks.setZoom,
    });
  });

  it("macos: applies native zoom at uiScale", async () => {
    platformMocks.platform = "macos";
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

  it("windows: CSS zoom at uiScale and native zoom pinned to 1", async () => {
    platformMocks.platform = "windows";
    renderHook(() =>
      useUiScaleShortcuts({
        settings: createSettings({ uiScale: 1.1 }),
        setSettings: vi.fn(),
        saveSettings: vi.fn(async (next) => next),
      }),
    );

    await waitFor(() => {
      expect(document.documentElement.style.zoom).toBe("1.1");
      expect(webviewMocks.setZoom).toHaveBeenCalledWith(1);
    });
    expect(webviewMocks.setZoom).not.toHaveBeenCalledWith(1.1);
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
      expect(document.documentElement.style.zoom).toBe("0.9");
    });
  });
});
