import { describe, expect, it } from "vitest";
import {
  FIRST_RUN_FLUID_DEPTH,
  FIRST_RUN_FLUID_HUE,
  WORKSPACE_FLUID_PRESETS,
  fluidToneColors,
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
    ]);
  });
});
