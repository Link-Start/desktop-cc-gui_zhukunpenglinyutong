import { describe, expect, it } from "vitest";
import { EMPTY_FIRST_RUN_SETUP_PROFILE } from "../types";
import {
  completeFirstRunSetup,
  markCliSkipped,
  markCliValidated,
  normalizeFirstRunSetupProfile,
  preferredIdeToOpenAppId,
  reopenFirstRunSetup,
} from "./setupProfile";
import { shouldOfferSetupBanner, shouldShowFirstRunSetup } from "./setupGate";

describe("first-run setup profile", () => {
  it("normalizes unknown payloads to an empty profile", () => {
    expect(normalizeFirstRunSetupProfile(null)).toEqual(
      EMPTY_FIRST_RUN_SETUP_PROFILE,
    );
    expect(normalizeFirstRunSetupProfile({ preferredIde: "wizard" }).preferredIde).toBe(
      null,
    );
  });

  it("maps a retired persona step onto the IDE step", () => {
    expect(normalizeFirstRunSetupProfile({ step: "persona" }).step).toBe("ide");
  });

  it("keeps known ide and validated engines", () => {
    const profile = normalizeFirstRunSetupProfile({
      preferredIde: "cursor",
      validatedEngines: ["claude", "claude", "unknown"],
      primaryEngine: "claude",
      level: "ready",
    });
    expect(profile.preferredIde).toBe("cursor");
    expect(profile.validatedEngines).toEqual(["claude"]);
    expect(profile.primaryEngine).toBe("claude");
    expect(profile.level).toBe("ready");
  });

  it("marks a validated CLI as ready and skip as partial", () => {
    const validated = markCliValidated(EMPTY_FIRST_RUN_SETUP_PROFILE, "codex");
    expect(validated.level).toBe("ready");
    expect(validated.validatedEngines).toEqual(["codex"]);
    expect(validated.primaryEngine).toBe("codex");

    const retargeted = markCliValidated(
      { ...validated, validatedEngines: ["claude", "codex"], primaryEngine: "claude" },
      "codex",
      { asPrimary: true },
    );
    expect(retargeted.primaryEngine).toBe("codex");
    expect(retargeted.validatedEngines).toEqual(["claude", "codex"]);

    const skipped = markCliSkipped(EMPTY_FIRST_RUN_SETUP_PROFILE);
    expect(skipped.level).toBe("partial");
    expect(skipped.skippedSteps).toEqual(["cli"]);
  });

  it("completes and reopens without losing the IDE habit", () => {
    const completed = completeFirstRunSetup({
      ...EMPTY_FIRST_RUN_SETUP_PROFILE,
      preferredIde: "idea",
      validatedEngines: ["claude"],
      primaryEngine: "claude",
    });
    expect(completed.dismissedAt).toBeTruthy();
    expect(completed.level).toBe("ready");

    const reopened = reopenFirstRunSetup(completed);
    expect(reopened.dismissedAt).toBeNull();
    expect(reopened.preferredIde).toBe("idea");
    expect(reopened.step).toBe("welcome");
  });

  it("maps IDE habits to open-app ids", () => {
    expect(preferredIdeToOpenAppId("vscode")).toBe("vscode");
    expect(preferredIdeToOpenAppId("none")).toBeNull();
    expect(preferredIdeToOpenAppId(null)).toBeNull();
  });
});

describe("first-run setup gate", () => {
  const noLegacy = {
    hasWorkspace: false,
    hasSeenReleaseNotes: false,
    hasPersistedEngine: false,
  };

  it("shows the wizard for a fresh unset profile", () => {
    expect(
      shouldShowFirstRunSetup(EMPTY_FIRST_RUN_SETUP_PROFILE, noLegacy),
    ).toBe(true);
  });

  it("hides the wizard for legacy workspace users", () => {
    expect(
      shouldShowFirstRunSetup(EMPTY_FIRST_RUN_SETUP_PROFILE, {
        ...noLegacy,
        hasWorkspace: true,
      }),
    ).toBe(false);
  });

  it("hides a dismissed profile and shows a partial banner", () => {
    const dismissed = completeFirstRunSetup(
      EMPTY_FIRST_RUN_SETUP_PROFILE,
      { skippedCli: true },
    );
    expect(shouldShowFirstRunSetup(dismissed, noLegacy)).toBe(false);
    expect(shouldOfferSetupBanner(dismissed)).toBe(true);
  });

  it("shows the wizard again after reopen", () => {
    const reopened = reopenFirstRunSetup(
      completeFirstRunSetup(EMPTY_FIRST_RUN_SETUP_PROFILE, { skippedCli: true }),
    );
    expect(shouldShowFirstRunSetup(reopened, noLegacy)).toBe(true);
    expect(shouldOfferSetupBanner(reopened)).toBe(false);
  });
});
