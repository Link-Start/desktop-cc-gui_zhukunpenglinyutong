/* @vitest-environment jsdom */
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUiScaleShortcuts } from "./useUiScaleShortcuts";
import type { AppSettings } from "../../../types";

const webviewMocks = vi.hoisted(() => ({
  getCurrentWebview: vi.fn(),
  setZoom: vi.fn(async () => undefined),
}));

vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: webviewMocks.getCurrentWebview,
}));

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
    webviewMocks.setZoom.mockReset();
    webviewMocks.setZoom.mockResolvedValue(undefined);
    webviewMocks.getCurrentWebview.mockReset();
    webviewMocks.getCurrentWebview.mockReturnValue({
      setZoom: webviewMocks.setZoom,
    });
  });

  it("applies zoom through the Tauri webview API", () => {
    const settings = createSettings({ uiScale: 1.1 });
    renderHook(() =>
      useUiScaleShortcuts({
        settings,
        setSettings: vi.fn(),
        saveSettings: vi.fn(async (next) => next),
      }),
    );

    expect(webviewMocks.getCurrentWebview).toHaveBeenCalled();
    expect(webviewMocks.setZoom).toHaveBeenCalledWith(1.1);
  });

  it("survives missing Tauri window metadata in browser previews", () => {
    webviewMocks.getCurrentWebview.mockImplementation(() => {
      throw new TypeError(
        "Cannot read properties of undefined (reading 'metadata')",
      );
    });

    expect(() =>
      renderHook(() =>
        useUiScaleShortcuts({
          settings: createSettings(),
          setSettings: vi.fn(),
          saveSettings: vi.fn(async (next) => next),
        }),
      ),
    ).not.toThrow();
  });
});
