export type TerminalAppearance = {
  theme: {
    background: string;
    foreground: string;
    cursor: string;
    selectionBackground?: string;
  };
  fontFamily: string;
  allowTransparency: boolean;
};

const DEFAULT_FONT_FAMILY = 'Menlo, Monaco, "Courier New", monospace';

type WallpaperRoot = {
  dataset: DOMStringMap;
};

export function isWorkspaceWallpaperDocumentActive(
  root: WallpaperRoot | null | undefined = typeof document === "undefined"
    ? null
    : document.documentElement,
): boolean {
  return Boolean(root?.dataset.workspaceWallpaper);
}

export function getTerminalAppearance(
  container: HTMLElement | null,
  root: WallpaperRoot | null | undefined = typeof document === "undefined"
    ? null
    : document.documentElement,
): TerminalAppearance {
  const wallpaperActive = isWorkspaceWallpaperDocumentActive(root);
  if (typeof window === "undefined") {
    return {
      theme: {
        background: wallpaperActive ? "transparent" : "#11151b",
        foreground: "#d9dee7",
        cursor: "#d9dee7",
      },
      fontFamily: DEFAULT_FONT_FAMILY,
      // Always on so toggling wallpaper later can punch through without remount.
      allowTransparency: true,
    };
  }

  const target =
    container ?? (root instanceof Element ? root : document.documentElement);
  const styles = getComputedStyle(target);
  const opaqueBackground =
    styles.getPropertyValue("--terminal-background").trim() ||
    styles.getPropertyValue("--surface-debug").trim() ||
    styles.getPropertyValue("--surface-panel").trim() ||
    "#11151b";
  const foreground =
    styles.getPropertyValue("--terminal-foreground").trim() ||
    styles.getPropertyValue("--text-stronger").trim() ||
    "#d9dee7";
  const cursor =
    styles.getPropertyValue("--terminal-cursor").trim() || foreground;
  const selection = styles.getPropertyValue("--terminal-selection").trim();
  const fontFamily =
    styles.getPropertyValue("--terminal-font-family").trim() ||
    styles.getPropertyValue("--code-font-family").trim() ||
    DEFAULT_FONT_FAMILY;

  return {
    theme: {
      background: wallpaperActive ? "transparent" : opaqueBackground,
      foreground,
      cursor,
      selectionBackground: selection || undefined,
    },
    fontFamily,
    // Always on so toggling wallpaper later can punch through without remount.
    allowTransparency: true,
  };
}

export function isTerminalAppearanceMutationAttribute(
  attributeName: string | null,
): boolean {
  return attributeName === "data-workspace-wallpaper";
}
