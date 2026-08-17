import { useEffect, useState, useSyncExternalStore } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { getAppSettings } from "../../../services/tauri";
import { FirstRunFluidBackdrop } from "../../onboarding/components/FirstRunFluidBackdrop";
import { DEFAULT_WORKSPACE_FLUID_PRESET } from "../../onboarding/utils/fluidTones";
import {
  resolveWorkspaceWallpaperMode,
  sanitizeWorkspaceWallpaperVeilOpacity,
} from "../utils/workspaceWallpaper";
import {
  getWorkspaceWallpaperSnapshot,
  isWorkspaceWallpaperSeeded,
  seedWorkspaceWallpaper,
  subscribeWorkspaceWallpaper,
} from "../utils/workspaceWallpaperStore";

function toAssetUrl(path: string): string {
  try {
    return convertFileSrc(path);
  } catch {
    return "";
  }
}

export function WorkspaceWallpaperHost() {
  const wallpaper = useSyncExternalStore(
    subscribeWorkspaceWallpaper,
    getWorkspaceWallpaperSnapshot,
  );
  const [hydrated, setHydrated] = useState(false);
  const [customFailed, setCustomFailed] = useState(false);

  useEffect(() => {
    // useAppSettings publishes the wallpaper snapshot when it finishes loading
    // settings; if that already happened, skip the duplicate IPC entirely.
    if (isWorkspaceWallpaperSeeded()) {
      setHydrated(true);
      return undefined;
    }
    let active = true;
    void getAppSettings()
      .then((settings) => {
        if (!active) {
          return;
        }
        seedWorkspaceWallpaper(settings.workspaceWallpaper);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) {
          setHydrated(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  const requestedMode = resolveWorkspaceWallpaperMode(wallpaper);
  const mode =
    requestedMode === "custom" && customFailed ? "fluid" : requestedMode;
  const customSrc =
    mode === "custom" && wallpaper.customImagePath
      ? toAssetUrl(wallpaper.customImagePath)
      : "";

  useEffect(() => {
    setCustomFailed(false);
  }, [wallpaper.customImagePath, wallpaper.mode]);

  // The data attribute gates the whole wallpaper CSS sheet; keep it in its own
  // effect keyed only on `mode` so a frost-only change never tears down and
  // re-applies the veil/backdrop-filter rules across every chrome pane.
  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }
    const root = document.documentElement;
    if (mode === "none") {
      delete root.dataset.workspaceWallpaper;
      return undefined;
    }
    root.dataset.workspaceWallpaper = mode;
    return () => {
      delete root.dataset.workspaceWallpaper;
    };
  }, [mode]);

  useEffect(() => {
    if (typeof document === "undefined" || mode === "none") {
      return undefined;
    }
    const root = document.documentElement;
    root.style.setProperty(
      "--workspace-wallpaper-frost",
      `${sanitizeWorkspaceWallpaperVeilOpacity(wallpaper.veilOpacity)}px`,
    );
    return () => {
      root.style.removeProperty("--workspace-wallpaper-frost");
    };
  }, [mode, wallpaper.veilOpacity]);

  if (!hydrated || mode === "none") {
    return null;
  }

  return (
    <div
      className="workspace-wallpaper"
      aria-hidden
      data-testid="workspace-wallpaper"
      data-mode={mode}
    >
      {mode === "fluid" ? (
        <FirstRunFluidBackdrop
          profile="lite"
          presetId={wallpaper.fluidPreset ?? DEFAULT_WORKSPACE_FLUID_PRESET}
        />
      ) : null}
      {mode === "custom" && customSrc ? (
        <img
          className="workspace-wallpaper-image"
          src={customSrc}
          alt=""
          decoding="async"
          onError={() => setCustomFailed(true)}
        />
      ) : null}
    </div>
  );
}
