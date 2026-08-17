import type {
  WorkspaceWallpaperFluidPreset,
  WorkspaceWallpaperMode,
  WorkspaceWallpaperSettings,
} from "../../../types";
import { isWindowsPlatform } from "../../../utils/platform";
import {
  DEFAULT_WORKSPACE_FLUID_PRESET,
  isWorkspaceFluidPresetId,
} from "../../onboarding/utils/fluidTones";

export const WORKSPACE_WALLPAPER_MODES = ["none", "fluid", "custom"] as const;

export const DEFAULT_WORKSPACE_WALLPAPER_VEIL_OPACITY = 12;
export const MIN_WORKSPACE_WALLPAPER_VEIL_OPACITY = 0;
export const MAX_WORKSPACE_WALLPAPER_VEIL_OPACITY = 20;

export const DEFAULT_WORKSPACE_WALLPAPER: WorkspaceWallpaperSettings = {
  mode: "none",
  customImagePath: null,
  fluidPreset: DEFAULT_WORKSPACE_FLUID_PRESET,
  veilOpacity: DEFAULT_WORKSPACE_WALLPAPER_VEIL_OPACITY,
};

export function sanitizeWorkspaceWallpaperVeilOpacity(
  value: number | null | undefined,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_WORKSPACE_WALLPAPER_VEIL_OPACITY;
  }
  return Math.min(
    MAX_WORKSPACE_WALLPAPER_VEIL_OPACITY,
    Math.max(MIN_WORKSPACE_WALLPAPER_VEIL_OPACITY, Math.round(value)),
  );
}

const CUSTOM_IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "bmp",
]);

export function isWorkspaceWallpaperMode(
  value: unknown,
): value is WorkspaceWallpaperMode {
  return (
    typeof value === "string" &&
    (WORKSPACE_WALLPAPER_MODES as readonly string[]).includes(value)
  );
}

function fileExtension(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const slash = normalized.lastIndexOf("/");
  const base = slash >= 0 ? normalized.slice(slash + 1) : normalized;
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) {
    return "";
  }
  return base.slice(dot + 1).toLowerCase();
}

export function sanitizeCustomWallpaperPath(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.includes("\0") || trimmed.includes("://")) {
    return null;
  }
  const extension = fileExtension(trimmed);
  if (!CUSTOM_IMAGE_EXTENSIONS.has(extension)) {
    return null;
  }
  return trimmed;
}

export function sanitizeWorkspaceWallpaper(
  value: WorkspaceWallpaperSettings | null | undefined,
): WorkspaceWallpaperSettings {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_WORKSPACE_WALLPAPER };
  }
  const customImagePath = sanitizeCustomWallpaperPath(value.customImagePath);
  const fluidPreset: WorkspaceWallpaperFluidPreset = isWorkspaceFluidPresetId(
    value.fluidPreset,
  )
    ? value.fluidPreset
    : DEFAULT_WORKSPACE_FLUID_PRESET;
  const veilOpacity = sanitizeWorkspaceWallpaperVeilOpacity(value.veilOpacity);
  if (value.mode === "custom") {
    return { mode: "custom", customImagePath, fluidPreset, veilOpacity };
  }
  if (value.mode === "none") {
    return { mode: "none", customImagePath, fluidPreset, veilOpacity };
  }
  if (value.mode === "fluid") {
    return { mode: "fluid", customImagePath, fluidPreset, veilOpacity };
  }
  return { ...DEFAULT_WORKSPACE_WALLPAPER };
}

export function isWorkspaceFluidWallpaperSupported(
  isWindows: boolean = isWindowsPlatform(),
): boolean {
  return !isWindows;
}

export function resolveWorkspaceWallpaperMode(
  wallpaper: WorkspaceWallpaperSettings,
  isWindows: boolean = isWindowsPlatform(),
): Exclude<WorkspaceWallpaperMode, never> {
  if (!isWorkspaceFluidWallpaperSupported(isWindows)) {
    return "none";
  }
  if (wallpaper.mode === "custom" && !wallpaper.customImagePath) {
    return "fluid";
  }
  return wallpaper.mode;
}
