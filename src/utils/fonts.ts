export const LEGACY_SYSTEM_UI_FONT_FAMILY =
  "\"SF Pro Text\", \"SF Pro Display\", -apple-system, BlinkMacSystemFont, \"Segoe UI\", \"Helvetica Neue\", sans-serif";

export const DEFAULT_UI_FONT_FAMILY =
  "\"SF Pro Text\", \"SF Pro Display\", -apple-system, BlinkMacSystemFont, \"Segoe UI Variable\", \"Segoe UI\", \"Microsoft YaHei UI\", \"Microsoft YaHei\", \"Helvetica Neue\", Arial, sans-serif";

export const LEGACY_MONACO_UI_FONT_FAMILY =
  "Monaco, \"SF Pro Text\", \"SF Pro Display\", -apple-system, \"Helvetica Neue\", sans-serif";

export const DEFAULT_CODE_FONT_FAMILY =
  "\"Cascadia Mono\", \"Cascadia Code\", Consolas, \"SF Mono\", \"SFMono-Regular\", Menlo, Monaco, monospace";

export const LEGACY_CODE_FONT_FAMILY =
  "Monaco, \"SF Mono\", \"SFMono-Regular\", Menlo, monospace";

export const CODE_FONT_SIZE_DEFAULT = 11;
export const CODE_FONT_SIZE_MIN = 9;
export const CODE_FONT_SIZE_MAX = 16;

/** Settings UI presets: 10px–15px. */
export const CODE_FONT_SIZE_PRESETS = [10, 11, 12, 13, 14, 15] as const;

export function isCodeFontSizePreset(value: number): boolean {
  return (CODE_FONT_SIZE_PRESETS as readonly number[]).includes(value);
}

/**
 * Options for the settings select. Values outside the preset grid (e.g. legacy
 * 9/16) are temporarily included so the control stays controlled.
 */
export function listCodeFontSizeSelectOptions(current: number): number[] {
  const resolved = clampCodeFontSize(current);
  if (isCodeFontSizePreset(resolved)) {
    return [...CODE_FONT_SIZE_PRESETS];
  }
  return [...CODE_FONT_SIZE_PRESETS, resolved].sort((a, b) => a - b);
}

export function normalizeFontFamily(
  value: string | null | undefined,
  fallback: string,
) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export function normalizeUiFontFamily(value: string | null | undefined) {
  const normalized = normalizeFontFamily(value, DEFAULT_UI_FONT_FAMILY);
  return normalized === LEGACY_MONACO_UI_FONT_FAMILY ||
    normalized === LEGACY_SYSTEM_UI_FONT_FAMILY
    ? DEFAULT_UI_FONT_FAMILY
    : normalized;
}

export function normalizeCodeFontFamily(value: string | null | undefined) {
  const normalized = normalizeFontFamily(value, DEFAULT_CODE_FONT_FAMILY);
  return normalized === LEGACY_CODE_FONT_FAMILY
    ? DEFAULT_CODE_FONT_FAMILY
    : normalized;
}

export function clampCodeFontSize(value: number) {
  if (!Number.isFinite(value)) {
    return CODE_FONT_SIZE_DEFAULT;
  }
  return Math.min(CODE_FONT_SIZE_MAX, Math.max(CODE_FONT_SIZE_MIN, value));
}
