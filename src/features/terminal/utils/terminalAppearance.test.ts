import { describe, expect, it } from "vitest";
import {
  getTerminalAppearance,
  isTerminalAppearanceMutationAttribute,
  isWorkspaceWallpaperDocumentActive,
} from "./terminalAppearance";

describe("terminal wallpaper appearance", () => {
  it("treats any data-workspace-wallpaper value as active", () => {
    expect(
      isWorkspaceWallpaperDocumentActive({
        dataset: { workspaceWallpaper: "fluid" } as DOMStringMap,
      }),
    ).toBe(true);
    expect(
      isWorkspaceWallpaperDocumentActive({
        dataset: { workspaceWallpaper: "custom" } as DOMStringMap,
      }),
    ).toBe(true);
    expect(
      isWorkspaceWallpaperDocumentActive({
        dataset: {} as DOMStringMap,
      }),
    ).toBe(false);
  });

  it("forces a transparent xterm canvas while wallpaper is on", () => {
    const appearance = getTerminalAppearance(null, {
      dataset: { workspaceWallpaper: "fluid" } as DOMStringMap,
    });
    expect(appearance.theme.background).toBe("transparent");
    expect(appearance.allowTransparency).toBe(true);
  });

  it("keeps the opaque theme background when wallpaper is off", () => {
    const appearance = getTerminalAppearance(null, {
      dataset: {} as DOMStringMap,
    });
    expect(appearance.theme.background).not.toBe("transparent");
    expect(appearance.allowTransparency).toBe(true);
  });

  it("refreshes appearance when the wallpaper data attribute changes", () => {
    expect(isTerminalAppearanceMutationAttribute("data-workspace-wallpaper")).toBe(
      true,
    );
    expect(isTerminalAppearanceMutationAttribute("data-theme")).toBe(false);
  });
});
