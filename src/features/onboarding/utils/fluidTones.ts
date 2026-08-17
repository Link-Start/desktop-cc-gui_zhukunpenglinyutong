/**
 * Continuous fluid palette adapted from DSH-Transparent-UI-Plugin (MIT).
 * Hue (0-360) and depth (0-100) drive the shader colors through HSL.
 */

export interface FluidToneColors {
  color1: string;
  color2: string;
  color3: string;
}

/** Slider 0/360 lands on the blue base, sweeping clockwise. */
export const HUE_BASE = 217;

/** Plugin default: cyan-blue wash that stays readable under light UI. */
export const FIRST_RUN_FLUID_HUE = 320;
export const FIRST_RUN_FLUID_DEPTH = 25;

export const WORKSPACE_FLUID_PRESETS = [
  { id: "mist", hue: 320, depth: 25 },
  { id: "aurora", hue: 150, depth: 28 },
  { id: "dusk", hue: 40, depth: 22 },
  { id: "orchid", hue: 250, depth: 26 },
  { id: "ember", hue: 5, depth: 20 },
  { id: "ink", hue: 200, depth: 8 },
] as const;

export type WorkspaceFluidPresetId = (typeof WORKSPACE_FLUID_PRESETS)[number]["id"];

export const DEFAULT_WORKSPACE_FLUID_PRESET: WorkspaceFluidPresetId = "mist";

export function isWorkspaceFluidPresetId(
  value: unknown,
): value is WorkspaceFluidPresetId {
  return (
    typeof value === "string" &&
    WORKSPACE_FLUID_PRESETS.some((preset) => preset.id === value)
  );
}

export function resolveWorkspaceFluidPreset(
  value: unknown,
): (typeof WORKSPACE_FLUID_PRESETS)[number] {
  return (
    WORKSPACE_FLUID_PRESETS.find((preset) => preset.id === value) ??
    WORKSPACE_FLUID_PRESETS[0]
  );
}

function hsl(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const toHex = (v: number): string =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Palette for the given hue (0-360) and depth (0-100), per scheme.
 * Depth 0 is the saturated extreme; 100 is the pale wash.
 */
export function fluidToneColors(
  dark: boolean,
  hue: number,
  depth: number,
): FluidToneColors {
  const h = (((hue + HUE_BASE) % 360) + 360) % 360;
  const d = Math.min(1, Math.max(0, depth / 100));
  const ramp = (deep: number, mid: number, pale: number): number =>
    d < 0.5
      ? deep + ((mid - deep) * d) / 0.5
      : mid + ((pale - mid) * (d - 0.5)) / 0.5;
  if (dark) {
    return {
      color1: hsl(h, 0.85, ramp(0, 0.46, 0.62)),
      color2: hsl(h, 0.9, ramp(0, 0.305, 0.45)),
      color3: hsl(h, 0.5, ramp(0, 0.075, 0.1)),
    };
  }
  return {
    color1: hsl(h, 1, ramp(0.27, 0.45, 0.9)),
    color2: hsl(h, 0.55, 0.86),
    color3: hsl(h, 0.25, 0.955),
  };
}
