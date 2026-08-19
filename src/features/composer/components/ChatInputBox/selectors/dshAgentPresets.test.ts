import { describe, expect, it } from "vitest";
import {
  DEFAULT_DSH_AGENT_PRESET,
  displayDshAgentPreset,
  isDshAgentPresetId,
  normalizeDshAgentPreset,
} from "./dshAgentPresets";

describe("dshAgentPresets", () => {
  it("normalizes blank and unknown values to the shipped default", () => {
    expect(normalizeDshAgentPreset(null)).toBe(DEFAULT_DSH_AGENT_PRESET);
    expect(normalizeDshAgentPreset("  ")).toBe(DEFAULT_DSH_AGENT_PRESET);
    expect(normalizeDshAgentPreset("custom-lab")).toBe(DEFAULT_DSH_AGENT_PRESET);
    expect(normalizeDshAgentPreset("minimal")).toBe("minimal");
  });

  it("keeps custom header ids for locked display", () => {
    expect(displayDshAgentPreset("custom-lab")).toBe("custom-lab");
    expect(displayDshAgentPreset(null)).toBe(DEFAULT_DSH_AGENT_PRESET);
    expect(isDshAgentPresetId("code")).toBe(true);
    expect(isDshAgentPresetId("custom-lab")).toBe(false);
  });
});
