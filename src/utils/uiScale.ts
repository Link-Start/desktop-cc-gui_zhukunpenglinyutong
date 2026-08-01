export const UI_SCALE_MIN = 0.8;
export const UI_SCALE_MAX = 2.6;
export const UI_SCALE_STEP = 0.1;
export const UI_SCALE_DEFAULT = 1;

/** Settings UI presets: 80%–150% in 10% steps. */
export const UI_SCALE_PRESETS = [
  0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5,
] as const;

const UI_SCALE_PRESET_EPS = 0.001;

export function clampUiScale(value: number) {
  if (!Number.isFinite(value)) {
    return UI_SCALE_DEFAULT;
  }
  const clamped = Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, value));
  return Number(clamped.toFixed(2));
}

export function sanitizeUiScale(value: number) {
  if (!Number.isFinite(value)) {
    return UI_SCALE_DEFAULT;
  }
  if (value < UI_SCALE_MIN || value > UI_SCALE_MAX) {
    return UI_SCALE_DEFAULT;
  }
  return Number(value.toFixed(2));
}

export function formatUiScale(value: number) {
  return clampUiScale(value).toFixed(1);
}

export function isUiScalePreset(value: number): boolean {
  return UI_SCALE_PRESETS.some(
    (preset) => Math.abs(preset - value) < UI_SCALE_PRESET_EPS,
  );
}

/** Match a stored scale to a preset option value when close enough. */
export function matchUiScalePreset(value: number): number | null {
  const matched = UI_SCALE_PRESETS.find(
    (preset) => Math.abs(preset - value) < UI_SCALE_PRESET_EPS,
  );
  return matched ?? null;
}

/**
 * Options for the settings select. Legacy / shortcut values outside the
 * preset grid are temporarily included so the control stays controlled.
 */
export function listUiScaleSelectOptions(current: number): number[] {
  const resolved = clampUiScale(current);
  if (matchUiScalePreset(resolved) !== null) {
    return [...UI_SCALE_PRESETS];
  }
  return [...UI_SCALE_PRESETS, resolved].sort((a, b) => a - b);
}

export function formatUiScalePercentLabel(value: number): string {
  return `${Math.round(clampUiScale(value) * 100)}%`;
}
