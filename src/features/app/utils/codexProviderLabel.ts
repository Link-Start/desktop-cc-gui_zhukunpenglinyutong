import type { ThreadSummary } from "../../../types";
import {
  CLAUDE_LOCAL_PROVIDER_PROFILE_ID,
  CODEX_DISK_PROVIDER_PROFILE_ID,
  KIMI_LOCAL_PROVIDER_PROFILE_ID,
} from "../../threads/constants/codexProviderProfiles";

const LOCAL_PROVIDER_PROFILE_IDS = new Set([
  CLAUDE_LOCAL_PROVIDER_PROFILE_ID,
  CODEX_DISK_PROVIDER_PROFILE_ID,
]);

export function resolveEngineProviderLabel(thread: ThreadSummary) {
  const engine = thread.engineSource ?? "codex";
  if (engine !== "claude" && engine !== "codex" && engine !== "kimi") {
    return null;
  }

  const profileId = thread.providerProfileId?.trim() ?? "";
  if (LOCAL_PROVIDER_PROFILE_IDS.has(profileId)) {
    return "local";
  }
  if (profileId === KIMI_LOCAL_PROVIDER_PROFILE_ID) {
    return null;
  }
  const label =
    thread.providerProfileName?.trim() ||
    (engine === "codex" ? thread.sourceLabel?.trim() : "") ||
    profileId;

  return label || null;
}

export const resolveCodexProviderLabel = resolveEngineProviderLabel;
