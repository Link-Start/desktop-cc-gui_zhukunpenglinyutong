import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORKSPACE_WALLPAPER,
  resolveWorkspaceWallpaperMode,
  sanitizeCustomWallpaperPath,
  sanitizeWorkspaceWallpaper,
} from "./workspaceWallpaper";

describe("workspaceWallpaper", () => {
  it("defaults missing wallpaper to off until the user opts in", () => {
    expect(sanitizeWorkspaceWallpaper(undefined)).toEqual(
      DEFAULT_WORKSPACE_WALLPAPER,
    );
    expect(sanitizeWorkspaceWallpaper(null)).toEqual(
      DEFAULT_WORKSPACE_WALLPAPER,
    );
  });

  it("keeps none and fluid modes and retains a valid custom path", () => {
    expect(
      sanitizeWorkspaceWallpaper({
        mode: "none",
        customImagePath: "/Users/me/Wall.png",
      }),
    ).toEqual({
      mode: "none",
      customImagePath: "/Users/me/Wall.png",
      fluidPreset: "mist",
      fluidMotion: "drift",
      veilOpacity: 12,
    });
    expect(
      sanitizeWorkspaceWallpaper({
        mode: "fluid",
        customImagePath: "C:\\Pictures\\bg.webp",
        fluidPreset: "orchid",
      }),
    ).toEqual({
      mode: "fluid",
      customImagePath: "C:\\Pictures\\bg.webp",
      fluidPreset: "orchid",
      fluidMotion: "drift",
      veilOpacity: 12,
    });
  });

  it("keeps a valid motion and falls unknown motion back to drift", () => {
    expect(
      sanitizeWorkspaceWallpaper({
        mode: "fluid",
        customImagePath: null,
        fluidPreset: "ash",
        fluidMotion: "tornado",
      }),
    ).toEqual({
      mode: "fluid",
      customImagePath: null,
      fluidPreset: "ash",
      fluidMotion: "tornado",
      veilOpacity: 12,
    });
    expect(
      sanitizeWorkspaceWallpaper({
        mode: "fluid",
        customImagePath: null,
        fluidPreset: "ash",
        fluidMotion: "chase",
      }).fluidMotion,
    ).toBe("chase");
    expect(
      sanitizeWorkspaceWallpaper({
        mode: "fluid",
        customImagePath: null,
        fluidPreset: "mist",
        fluidMotion: "typhoon" as never,
      }).fluidMotion,
    ).toBe("drift");
    expect(
      sanitizeWorkspaceWallpaper({
        mode: "fluid",
        customImagePath: null,
        fluidPreset: "nope" as never,
        fluidMotion: "storm",
      }),
    ).toEqual({
      mode: "fluid",
      customImagePath: null,
      fluidPreset: "mist",
      fluidMotion: "storm",
      veilOpacity: 12,
    });
  });

  it("keeps custom mode when the path is empty and drops illegal paths", () => {
    expect(
      sanitizeWorkspaceWallpaper({
        mode: "custom",
        customImagePath: null,
      }),
    ).toEqual({
      mode: "custom",
      customImagePath: null,
      fluidPreset: "mist",
      fluidMotion: "drift",
      veilOpacity: 12,
    });
    expect(
      sanitizeWorkspaceWallpaper({
        mode: "custom",
        customImagePath: "  ",
      }),
    ).toEqual({
      mode: "custom",
      customImagePath: null,
      fluidPreset: "mist",
      fluidMotion: "drift",
      veilOpacity: 12,
    });
    expect(
      sanitizeWorkspaceWallpaper({
        mode: "custom",
        customImagePath: "/tmp/notes.txt",
      }),
    ).toEqual({
      mode: "custom",
      customImagePath: null,
      fluidPreset: "mist",
      fluidMotion: "drift",
      veilOpacity: 12,
    });
    expect(
      sanitizeWorkspaceWallpaper({
        mode: "custom",
        customImagePath: "https://example.com/bg.png",
      }),
    ).toEqual({
      mode: "custom",
      customImagePath: null,
      fluidPreset: "mist",
      fluidMotion: "drift",
      veilOpacity: 12,
    });
  });

  it("rejects remote urls and unknown extensions for custom paths", () => {
    expect(sanitizeCustomWallpaperPath("asset://localhost/x.png")).toBeNull();
    expect(sanitizeCustomWallpaperPath("/tmp/photo.heic")).toBeNull();
    expect(sanitizeCustomWallpaperPath("/tmp/photo.jpeg")).toBe(
      "/tmp/photo.jpeg",
    );
  });

  it("resolves persisted fluid and custom modes without a platform gate", () => {
    expect(
      resolveWorkspaceWallpaperMode({
        mode: "fluid",
        customImagePath: null,
        fluidPreset: "mist",
        veilOpacity: 12,
      }),
    ).toBe("fluid");
    expect(
      resolveWorkspaceWallpaperMode({
        mode: "custom",
        customImagePath: "/tmp/wall.png",
        fluidPreset: "mist",
        veilOpacity: 12,
      }),
    ).toBe("custom");
    expect(
      resolveWorkspaceWallpaperMode({
        mode: "custom",
        customImagePath: null,
        fluidPreset: "mist",
        veilOpacity: 12,
      }),
    ).toBe("fluid");
    expect(
      resolveWorkspaceWallpaperMode({
        mode: "none",
        customImagePath: null,
        fluidPreset: "mist",
        veilOpacity: 12,
      }),
    ).toBe("none");
  });

  it("clamps frost blur to the readable chrome range", () => {
    expect(
      sanitizeWorkspaceWallpaper({
        mode: "fluid",
        customImagePath: null,
        veilOpacity: 16,
      }).veilOpacity,
    ).toBe(16);
    expect(
      sanitizeWorkspaceWallpaper({
        mode: "fluid",
        customImagePath: null,
        veilOpacity: -4,
      }).veilOpacity,
    ).toBe(0);
    expect(
      sanitizeWorkspaceWallpaper({
        mode: "fluid",
        customImagePath: null,
        veilOpacity: 48,
      }).veilOpacity,
    ).toBe(20);
  });
});
