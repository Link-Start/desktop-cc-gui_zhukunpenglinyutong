import type { EngineType } from "../../../types";
import { isSupportedEngineType } from "../../engine/engineRegistry";
import {
  EMPTY_FIRST_RUN_SETUP_PROFILE,
  FIRST_RUN_IDES,
  FIRST_RUN_SETUP_STEPS,
  FIRST_RUN_SETUP_VERSION,
  type FirstRunIdeId,
  type FirstRunSetupLevel,
  type FirstRunSetupProfile,
  type FirstRunSetupStep,
} from "../types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSetupStep(value: unknown): value is FirstRunSetupStep {
  return (
    typeof value === "string" &&
    (FIRST_RUN_SETUP_STEPS as readonly string[]).includes(value)
  );
}

function normalizeSetupStep(value: unknown): FirstRunSetupStep {
  if (value === "persona") {
    return "ide";
  }
  return isSetupStep(value) ? value : "welcome";
}

function isIde(value: unknown): value is FirstRunIdeId {
  return (
    typeof value === "string" &&
    (FIRST_RUN_IDES as readonly string[]).includes(value)
  );
}

function isSetupLevel(value: unknown): value is FirstRunSetupLevel {
  return value === "unset" || value === "partial" || value === "ready";
}

function normalizeEngineList(value: unknown): EngineType[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const next: EngineType[] = [];
  for (const entry of value) {
    if (isSupportedEngineType(entry) && !next.includes(entry)) {
      next.push(entry);
    }
  }
  return next;
}

function normalizeSkippedSteps(value: unknown): FirstRunSetupStep[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const next: FirstRunSetupStep[] = [];
  for (const entry of value) {
    if (isSetupStep(entry) && !next.includes(entry)) {
      next.push(entry);
    }
  }
  return next;
}

export function normalizeFirstRunSetupProfile(
  raw: unknown,
): FirstRunSetupProfile {
  if (!isRecord(raw)) {
    return { ...EMPTY_FIRST_RUN_SETUP_PROFILE };
  }

  const validatedEngines = normalizeEngineList(raw.validatedEngines);
  const primaryEngine = isSupportedEngineType(raw.primaryEngine)
    ? raw.primaryEngine
    : (validatedEngines[0] ?? null);
  const level = isSetupLevel(raw.level)
    ? raw.level
    : validatedEngines.length > 0
      ? "ready"
      : "unset";

  return {
    version: FIRST_RUN_SETUP_VERSION,
    level,
    step: normalizeSetupStep(raw.step),
    preferredIde: isIde(raw.preferredIde) ? raw.preferredIde : null,
    primaryEngine,
    validatedEngines,
    skippedSteps: normalizeSkippedSteps(raw.skippedSteps),
    legacyExempted: raw.legacyExempted === true,
    completedAt: typeof raw.completedAt === "string" ? raw.completedAt : null,
    dismissedAt: typeof raw.dismissedAt === "string" ? raw.dismissedAt : null,
  };
}

export function hasValidatedCli(profile: FirstRunSetupProfile): boolean {
  return profile.validatedEngines.length > 0;
}

export function markCliValidated(
  profile: FirstRunSetupProfile,
  engine: EngineType,
  options?: { asPrimary?: boolean },
): FirstRunSetupProfile {
  const validatedEngines = profile.validatedEngines.includes(engine)
    ? profile.validatedEngines
    : [...profile.validatedEngines, engine];
  return {
    ...profile,
    primaryEngine:
      options?.asPrimary === true ? engine : (profile.primaryEngine ?? engine),
    validatedEngines,
    skippedSteps: profile.skippedSteps.filter((step) => step !== "cli"),
    level: "ready",
  };
}

export function markCliSkipped(profile: FirstRunSetupProfile): FirstRunSetupProfile {
  const skippedSteps: FirstRunSetupStep[] = profile.skippedSteps.includes("cli")
    ? profile.skippedSteps
    : [...profile.skippedSteps, "cli"];
  return {
    ...profile,
    skippedSteps,
    level: hasValidatedCli(profile) ? "ready" : "partial",
  };
}

export function completeFirstRunSetup(
  profile: FirstRunSetupProfile,
  options?: { skippedCli?: boolean },
): FirstRunSetupProfile {
  const next = options?.skippedCli ? markCliSkipped(profile) : profile;
  const now = new Date().toISOString();
  return {
    ...next,
    step: "done",
    level: hasValidatedCli(next) ? "ready" : "partial",
    completedAt: now,
    dismissedAt: now,
    legacyExempted: false,
  };
}

export function reopenFirstRunSetup(
  profile: FirstRunSetupProfile,
): FirstRunSetupProfile {
  return {
    ...profile,
    step: "welcome",
    dismissedAt: null,
    legacyExempted: false,
  };
}

export function markLegacyExempted(): FirstRunSetupProfile {
  const now = new Date().toISOString();
  return {
    ...EMPTY_FIRST_RUN_SETUP_PROFILE,
    level: "ready",
    step: "done",
    legacyExempted: true,
    completedAt: now,
    dismissedAt: now,
  };
}

export function preferredIdeToOpenAppId(ide: FirstRunIdeId | null): string | null {
  if (!ide || ide === "none") {
    return null;
  }
  return ide;
}
