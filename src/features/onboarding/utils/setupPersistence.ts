import { writeClientStoreValue } from "../../../services/clientStorage";
import {
  FIRST_RUN_SETUP_KEY,
  FIRST_RUN_SETUP_STORE,
  type FirstRunSetupProfile,
} from "../types";
import { notifyFirstRunSetupChanged } from "./setupEvents";
import { normalizeFirstRunSetupProfile } from "./setupProfile";

export function persistFirstRunSetupProfile(
  profile: FirstRunSetupProfile,
): FirstRunSetupProfile {
  const normalized = normalizeFirstRunSetupProfile(profile);
  writeClientStoreValue(FIRST_RUN_SETUP_STORE, FIRST_RUN_SETUP_KEY, normalized, {
    immediate: true,
  });
  notifyFirstRunSetupChanged();
  return normalized;
}
