import { describe, expect, it } from "vitest";
import {
  FIRST_RUN_FLUID_DEPTH,
  FIRST_RUN_FLUID_HUE,
  WORKSPACE_FLUID_MOTIONS,
  WORKSPACE_FLUID_PRESETS,
  fluidPresetChroma,
  fluidPresetToneColors,
  fluidToneColors,
  resolveWorkspaceFluidMotion,
  resolveWorkspaceFluidPreset,
} from "./fluidTones";

describe("fluidToneColors", () => {
  it("returns hex stops for the first-run light wash", () => {
    const tones = fluidToneColors(
      false,
      FIRST_RUN_FLUID_HUE,
      FIRST_RUN_FLUID_DEPTH,
    );
    expect(tones.color1).toMatch(/^#[0-9a-f]{6}$/);
    expect(tones.color2).toMatch(/^#[0-9a-f]{6}$/);
    expect(tones.color3).toMatch(/^#[0-9a-f]{6}$/);
    expect(tones.color3).not.toBe(tones.color1);
  });

  it("keeps dark-mode base darker than the bloom stop", () => {
    const tones = fluidToneColors(true, FIRST_RUN_FLUID_HUE, FIRST_RUN_FLUID_DEPTH);
    const luminance = (hex: string): number => {
      const value = parseInt(hex.slice(1), 16);
      const r = (value >> 16) & 255;
      const g = (value >> 8) & 255;
      const b = value & 255;
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    expect(luminance(tones.color3)).toBeLessThan(luminance(tones.color1));
  });

  it("keeps unknown fluid presets on the first-run mist wash", () => {
    expect(resolveWorkspaceFluidPreset("nope").id).toBe("mist");
    expect(WORKSPACE_FLUID_PRESETS.map((preset) => preset.id)).toEqual([
      "mist",
      "aurora",
      "dusk",
      "orchid",
      "ember",
      "ink",
      "ash",
    ]);
  });

  it("keeps ash as a low-chroma gray wash distinct from ink", () => {
    const ash = resolveWorkspaceFluidPreset("ash");
    const ink = resolveWorkspaceFluidPreset("ink");
    const ashLight = fluidPresetToneColors(false, ash);
    const inkLight = fluidPresetToneColors(false, ink);
    const ashDark = fluidPresetToneColors(true, ash);
    const channelSpread = (hex: string): number => {
      const value = parseInt(hex.slice(1), 16);
      const r = (value >> 16) & 255;
      const g = (value >> 8) & 255;
      const b = value & 255;
      return Math.max(r, g, b) - Math.min(r, g, b);
    };
    expect(fluidPresetChroma(ash)).toBe(0.06);
    expect(channelSpread(ashLight.color1)).toBeLessThan(
      channelSpread(inkLight.color1),
    );
    expect(channelSpread(ashDark.color1)).toBeLessThan(40);
    expect(ashLight.color1).not.toBe(inkLight.color1);
  });

  it("falls unknown motion back to drift", () => {
    expect(resolveWorkspaceFluidMotion("nope").id).toBe("drift");
    expect(WORKSPACE_FLUID_MOTIONS.map((motion) => motion.id)).toEqual([
      "drift",
      "taiji",
      "storm",
      "tornado",
      "chase",
    ]);
  });
});
