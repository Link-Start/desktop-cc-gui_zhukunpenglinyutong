import {
  getClientStoreSync,
  isClientStoreReady,
} from "../../../services/clientStorage";
import { readPersistedEngineSelection } from "../../engine/hooks/engineControllerSelection";
import { loadSidebarSnapshot } from "../../threads/utils/sidebarSnapshot";
import {
  EMPTY_FIRST_RUN_SETUP_PROFILE,
  FIRST_RUN_SETUP_KEY,
  FIRST_RUN_SETUP_STORE,
  type FirstRunSetupProfile,
} from "../types";
import { normalizeFirstRunSetupProfile } from "./setupProfile";

export type FirstRunLegacySignals = {
  hasWorkspace: boolean;
  hasSeenReleaseNotes: boolean;
  hasPersistedEngine: boolean;
};

export function readFirstRunSetupProfile(): FirstRunSetupProfile {
  if (!isClientStoreReady(FIRST_RUN_SETUP_STORE)) {
    return { ...EMPTY_FIRST_RUN_SETUP_PROFILE };
  }
  return normalizeFirstRunSetupProfile(
    getClientStoreSync(FIRST_RUN_SETUP_STORE, FIRST_RUN_SETUP_KEY),
  );
}

export function collectFirstRunLegacySignals(): FirstRunLegacySignals {
  const snapshot = isClientStoreReady("threads") ? loadSidebarSnapshot() : null;
  const releaseNotesLastSeen = isClientStoreReady("app")
    ? getClientStoreSync<string>("app", "releaseNotesLastSeenVersion")
    : undefined;
  const persistedEngine = isClientStoreReady("composer")
    ? readPersistedEngineSelection()
    : null;
  return {
    hasWorkspace: Boolean(snapshot?.workspaces.length),
    hasSeenReleaseNotes: Boolean(releaseNotesLastSeen?.trim()),
    hasPersistedEngine: persistedEngine !== null,
  };
}

export function hasFirstRunLegacyExemption(
  signals: FirstRunLegacySignals = collectFirstRunLegacySignals(),
): boolean {
  return (
    signals.hasWorkspace ||
    signals.hasSeenReleaseNotes ||
    signals.hasPersistedEngine
  );
}

export function shouldShowFirstRunSetup(
  profile: FirstRunSetupProfile = readFirstRunSetupProfile(),
  signals: FirstRunLegacySignals = collectFirstRunLegacySignals(),
): boolean {
  if (profile.dismissedAt) {
    return false;
  }
  if (profile.legacyExempted) {
    return false;
  }
  if (profile.level !== "unset") {
    return true;
  }
  return !hasFirstRunLegacyExemption(signals);
}

export function shouldOfferSetupBanner(
  profile: FirstRunSetupProfile = readFirstRunSetupProfile(),
): boolean {
  return (
    profile.dismissedAt !== null &&
    profile.level === "partial" &&
    !profile.legacyExempted
  );
}
