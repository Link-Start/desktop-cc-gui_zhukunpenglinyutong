/** @vitest-environment jsdom */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resetWorkspaceWallpaperStoreForTests,
} from "../utils/workspaceWallpaperStore";

vi.mock("../../onboarding/components/FirstRunFluidBackdrop", () => ({
  FirstRunFluidBackdrop: ({
    profile,
    motionId,
    speed,
    forceAnimate,
    onAttachChange,
  }: {
    profile?: string;
    motionId?: string;
    speed?: number;
    forceAnimate?: boolean;
    onAttachChange?: (attached: boolean) => void;
  }) => {
    useEffect(() => {
      onAttachChange?.(true);
      return () => onAttachChange?.(false);
    }, [onAttachChange]);
    return (
      <div
        data-testid="first-run-fluid"
        aria-hidden
        data-profile={profile ?? "full"}
        data-motion={motionId ?? "drift"}
        data-animate={forceAnimate ? "true" : "false"}
        data-speed={speed === undefined ? "" : String(speed)}
      />
    );
  },
}));

const platformMocks = vi.hoisted(() => ({
  isWindowsPlatform: vi.fn(() => false),
}));

vi.mock("../../../utils/platform", () => ({
  isWindowsPlatform: platformMocks.isWindowsPlatform,
}));

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset://localhost${path}`,
}));

const getAppSettings = vi.hoisted(() =>
  vi.fn(
    async (): Promise<{
      workspaceWallpaper: {
        mode: string;
        customImagePath: string | null;
        veilOpacity?: number;
        fluidPreset?: string;
        fluidMotion?: string;
      };
    }> => ({
      workspaceWallpaper: { mode: "none", customImagePath: null },
    }),
  ),
);

vi.mock("../../../services/tauri", () => ({
  getAppSettings,
}));

import { WorkspaceWallpaperHost } from "./WorkspaceWallpaperHost";

describe("WorkspaceWallpaperHost", () => {
  afterEach(() => {
    cleanup();
    resetWorkspaceWallpaperStoreForTests();
    getAppSettings.mockReset();
    getAppSettings.mockResolvedValue({
      workspaceWallpaper: { mode: "none", customImagePath: null },
    });
    delete document.documentElement.dataset.workspaceWallpaper;
    platformMocks.isWindowsPlatform.mockReset();
    platformMocks.isWindowsPlatform.mockReturnValue(false);
  });

  it("does not mount a wallpaper layer by default", async () => {
    render(<WorkspaceWallpaperHost />);
    await waitFor(() => {
      expect(getAppSettings).toHaveBeenCalled();
    });
    expect(screen.queryByTestId("workspace-wallpaper")).toBeNull();
    expect(document.documentElement.dataset.workspaceWallpaper).toBeUndefined();
  });

  it("renders the first-run fluid backdrop when the user opts in", async () => {
    getAppSettings.mockResolvedValueOnce({
      workspaceWallpaper: { mode: "fluid", customImagePath: null },
    });
    render(<WorkspaceWallpaperHost />);
    await waitFor(() => {
      expect(screen.getByTestId("workspace-wallpaper").dataset.mode).toBe(
        "fluid",
      );
    });
    expect(screen.getByTestId("first-run-fluid")).not.toBeNull();
    expect(screen.getByTestId("first-run-fluid").dataset.animate).toBe("false");
    expect(screen.getByTestId("first-run-fluid").dataset.motion).toBe("drift");
    await waitFor(() => {
      expect(document.documentElement.dataset.workspaceWallpaper).toBe("fluid");
    });
  });

  it("forwards a persisted structured motion to the fluid backdrop", async () => {
    getAppSettings.mockResolvedValueOnce({
      workspaceWallpaper: {
        mode: "fluid",
        customImagePath: null,
        fluidMotion: "tornado",
      },
    });
    render(<WorkspaceWallpaperHost />);
    await waitFor(() => {
      expect(screen.getByTestId("first-run-fluid").dataset.motion).toBe(
        "tornado",
      );
    });
  });

  it("does not mount a wallpaper layer when mode is none", async () => {
    getAppSettings.mockResolvedValueOnce({
      workspaceWallpaper: { mode: "none", customImagePath: null },
    });
    render(<WorkspaceWallpaperHost />);
    await waitFor(() => {
      expect(getAppSettings).toHaveBeenCalled();
    });
    expect(screen.queryByTestId("workspace-wallpaper")).toBeNull();
    expect(document.documentElement.dataset.workspaceWallpaper).toBeUndefined();
  });

  it("renders a custom cover image from the persisted path", async () => {
    getAppSettings.mockResolvedValueOnce({
      workspaceWallpaper: {
        mode: "custom",
        customImagePath: "/Users/me/Wall.png",
      },
    });
    render(<WorkspaceWallpaperHost />);
    await waitFor(() => {
      expect(screen.getByTestId("workspace-wallpaper").dataset.mode).toBe(
        "custom",
      );
    });
    const host = screen.getByTestId("workspace-wallpaper");
    const image = host.querySelector("img");
    expect(image?.getAttribute("src")).toBe("asset://localhost/Users/me/Wall.png");
    expect(screen.queryByTestId("first-run-fluid")).toBeNull();
    expect(
      document.documentElement.style.getPropertyValue(
        "--workspace-wallpaper-frost",
      ),
    ).toBe("12px");
  });

  it("writes the persisted frost blur onto the document root", async () => {
    getAppSettings.mockResolvedValueOnce({
      workspaceWallpaper: {
        mode: "fluid",
        customImagePath: null,
        veilOpacity: 18,
      },
    });
    render(<WorkspaceWallpaperHost />);
    await waitFor(() => {
      expect(
        document.documentElement.style.getPropertyValue(
          "--workspace-wallpaper-frost",
        ),
      ).toBe("18px");
    });
  });

  it("keeps the workspace fluid backdrop on the lite profile", async () => {
    getAppSettings.mockResolvedValueOnce({
      workspaceWallpaper: { mode: "fluid", customImagePath: null },
    });
    render(<WorkspaceWallpaperHost />);
    await waitFor(() => {
      expect(screen.getByTestId("first-run-fluid").dataset.profile).toBe("lite");
    });
  });

  it("forwards sanitized motion and workspace speed to the fluid backdrop", async () => {
    getAppSettings.mockResolvedValueOnce({
      workspaceWallpaper: {
        mode: "fluid",
        customImagePath: null,
        fluidMotion: "taiji",
      },
    });
    render(<WorkspaceWallpaperHost />);
    await waitFor(() => {
      expect(screen.getByTestId("first-run-fluid").dataset.motion).toBe("taiji");
    });
    expect(screen.getByTestId("first-run-fluid").dataset.speed).toBe("9");
  });

  it("applies WebView2 fluid compat only on Windows", async () => {
    platformMocks.isWindowsPlatform.mockReturnValue(true);
    getAppSettings.mockResolvedValueOnce({
      workspaceWallpaper: { mode: "fluid", customImagePath: null },
    });
    render(<WorkspaceWallpaperHost />);
    await waitFor(() => {
      expect(screen.getByTestId("first-run-fluid").dataset.animate).toBe(
        "true",
      );
    });
    await waitFor(() => {
      expect(document.documentElement.dataset.workspaceWallpaper).toBe("fluid");
    });
  });
});
