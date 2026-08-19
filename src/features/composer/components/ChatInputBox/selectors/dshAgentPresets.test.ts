import { describe, expect, it } from "vitest";
import {
  DEFAULT_DSH_AGENT_PRESET,
  displayDshAgentPreset,
  isDshAgentPresetId,
  normalizeDshAgentPreset,
  persistableDshAgentPreset,
  resolveDshComposerAgentPreset,
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

  it("keeps existing DSH sessions on their header, not the last blank pref", () => {
    expect(
      resolveDshComposerAgentPreset({
        threadId: "dsh:sess-a",
        sessionHeader: "code",
        draftOrPref: "minimal",
        hasUserMessages: false,
      }),
    ).toEqual({ value: "code", locked: true });
    expect(
      resolveDshComposerAgentPreset({
        threadId: "dsh:sess-b",
        sessionHeader: null,
        draftOrPref: "minimal",
        hasUserMessages: false,
      }),
    ).toEqual({ value: DEFAULT_DSH_AGENT_PRESET, locked: true });
    expect(
      resolveDshComposerAgentPreset({
        threadId: "dsh-pending-1",
        sessionHeader: null,
        draftOrPref: "minimal",
      }),
    ).toEqual({ value: "minimal", locked: false });
  });

  it("does not persist a guessed standard onto a headerless live session", () => {
    expect(persistableDshAgentPreset(null, "standard")).toBeNull();
    expect(persistableDshAgentPreset("", "standard")).toBeNull();
    expect(persistableDshAgentPreset("code", "standard")).toBe("code");
    expect(persistableDshAgentPreset(null, "minimal")).toBe("minimal");
  });
});
