/* @vitest-environment jsdom */
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUiScaleShortcuts } from "./useUiScaleShortcuts";
import type { AppSettings } from "../../../types";
import type { RendererPlatform } from "../../../utils/rendererPlatform";
import { resetUiScaleNativePinForTests } from "../../../utils/applyUiScale";
import {
  readUiScaleStartupGuardRecord,
  resetUiScaleStartupGuardForTests,
} from "../../../utils/uiScaleStartupGuard";

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
    resetUiScaleStartupGuardForTests();
    platformMocks.platform = "macos";
    document.documentElement.style.zoom = "";
    document.documentElement.style.width = "";
    document.documentElement.style.height = "";
    document.documentElement.style.transform = "";
    document.documentElement.style.removeProperty("--ui-scale");
    document.body.style.zoom = "";
    document.body.style.width = "";
    document.body.style.height = "";
    document.body.style.transform = "";
    document.body.style.position = "";
    webviewMocks.setZoom.mockReset();
    webviewMocks.setZoom.mockResolvedValue(undefined);
    webviewMocks.getCurrentWebview.mockReset();
    webviewMocks.getCurrentWebview.mockReturnValue({
      setZoom: webviewMocks.setZoom,
    });
  });

  it("macos: CSS zoom on body, native zoom pinned to 1", async () => {
    platformMocks.platform = "macos";
    document.documentElement.style.zoom = "0.8";
    document.body.style.zoom = "0.8";
    const settings = createSettings({ uiScale: 1.1 });
    renderHook(() =>
      useUiScaleShortcuts({
        settings,
        setSettings: vi.fn(),
        saveSettings: vi.fn(async (next) => next),
      }),
    );

    await waitFor(() => {
      expect(document.documentElement.style.zoom).toBe("");
      expect(document.body.style.zoom).toBe("1.1");
      expect(document.body.style.transform).toBe("");
      expect(webviewMocks.setZoom).toHaveBeenCalledWith(1);
    });
    expect(webviewMocks.setZoom).not.toHaveBeenCalledWith(1.1);
  });

  it("linux: CSS zoom path (native pinned to 1)", async () => {
    platformMocks.platform = "linux";
    renderHook(() =>
      useUiScaleShortcuts({
        settings: createSettings({ uiScale: 0.8 }),
        setSettings: vi.fn(),
        saveSettings: vi.fn(async (next) => next),
      }),
    );

    await waitFor(() => {
      expect(document.body.style.zoom).toBe("0.8");
      expect(document.body.style.transform).toBe("");
      expect(webviewMocks.setZoom).toHaveBeenCalledWith(1);
    });
    expect(webviewMocks.setZoom).not.toHaveBeenCalledWith(0.8);
  });

  it("windows: CSS zoom on body, no transform fill, native pin 1", async () => {
    platformMocks.platform = "windows";
    renderHook(() =>
      useUiScaleShortcuts({
        settings: createSettings({ uiScale: 0.8 }),
        setSettings: vi.fn(),
        saveSettings: vi.fn(async (next) => next),
      }),
    );

    await waitFor(() => {
      expect(document.documentElement.style.zoom).toBe("");
      expect(document.body.style.zoom).toBe("0.8");
      expect(document.body.style.transform).toBe("");
      expect(document.body.style.width).toBe("");
      expect(document.body.style.position).toBe("");
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
      expect(document.body.style.zoom).toBe("0.9");
      expect(document.body.style.transform).toBe("");
    });
  });

  it("non-identity apply records a pending startup-guard mark", async () => {
    platformMocks.platform = "macos";
    renderHook(() =>
      useUiScaleShortcuts({
        settings: createSettings({ uiScale: 0.9 }),
        setSettings: vi.fn(),
        saveSettings: vi.fn(async (next) => next),
      }),
    );

    await waitFor(() => {
      expect(readUiScaleStartupGuardRecord()?.scale).toBe(0.9);
    });
  });

  it("startup guard forces identity scale for one session after an unhealthy ≠1 launch", async () => {
    platformMocks.platform = "macos";
    window.localStorage.setItem(
      "ccgui.uiScaleStartupGuard.v1",
      JSON.stringify({ scale: 0.9, markedAt: Date.now() }),
    );
    document.body.style.zoom = "0.9";
    document.body.style.transform = "scale(0.9)";
    document.body.style.width = `${100 / 0.9}%`;
    document.body.style.position = "fixed";

    renderHook(() =>
      useUiScaleShortcuts({
        settings: createSettings({ uiScale: 0.9 }),
        setSettings: vi.fn(),
        saveSettings: vi.fn(async (next) => next),
      }),
    );

    await waitFor(() => {
      expect(document.body.style.zoom).toBe("");
      expect(document.body.style.transform).toBe("");
      expect(document.body.style.width).toBe("");
      expect(document.body.style.position).toBe("");
      expect(readUiScaleStartupGuardRecord()).toBeNull();
    });
  });
});
