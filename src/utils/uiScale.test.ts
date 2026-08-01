import { describe, expect, it } from "vitest";
import {
  clampUiScale,
  formatUiScalePercentLabel,
  listUiScaleSelectOptions,
  matchUiScalePreset,
  sanitizeUiScale,
  UI_SCALE_DEFAULT,
  UI_SCALE_MAX,
  UI_SCALE_MIN,
  UI_SCALE_PRESETS,
} from "./uiScale";

describe("uiScale utilities", () => {
  it("clamps to supported range", () => {
    expect(clampUiScale(UI_SCALE_MIN - 0.2)).toBe(UI_SCALE_MIN);
    expect(clampUiScale(UI_SCALE_MAX + 0.2)).toBe(UI_SCALE_MAX);
  });

  it("retains supported precision values", () => {
    expect(clampUiScale(1.25)).toBe(1.25);
    expect(clampUiScale(2.6)).toBe(2.6);
  });

  it("sanitizes persisted invalid values to default", () => {
    expect(sanitizeUiScale(Number.NaN)).toBe(UI_SCALE_DEFAULT);
    expect(sanitizeUiScale(0.2)).toBe(UI_SCALE_DEFAULT);
    expect(sanitizeUiScale(2.7)).toBe(UI_SCALE_DEFAULT);
  });

  it("exposes 80%–150% presets in 10% steps", () => {
    expect(UI_SCALE_PRESETS).toEqual([0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5]);
    expect(formatUiScalePercentLabel(1.2)).toBe("120%");
    expect(matchUiScalePreset(1)).toBe(1);
    expect(matchUiScalePreset(1.25)).toBeNull();
  });

  it("temporarily includes legacy values outside the preset grid", () => {
    expect(listUiScaleSelectOptions(1)).toEqual([...UI_SCALE_PRESETS]);
    expect(listUiScaleSelectOptions(1.25)).toEqual([
      0.8, 0.9, 1, 1.1, 1.2, 1.25, 1.3, 1.4, 1.5,
    ]);
  });
});
