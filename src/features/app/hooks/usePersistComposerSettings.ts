import { useEffect } from "react";
import type { AppSettings } from "../../../types";

type Params = {
  enabled: boolean;
  appSettingsLoading: boolean;
  selectionReady: boolean;
  selectedModelId: string | null;
  selectedEffort: string | null;
  /**
   * When false, keep the previously stored lastComposerModelId (e.g. while a
   * thread-scoped freeform model is active and should not clobber global pref).
   */
  persistModelId?: boolean;
  /**
   * When false, keep the previously stored lastComposerReasoningEffort.
   * Default true so user effort is remembered across threads and restarts.
   */
  persistEffort?: boolean;
  setAppSettings: (updater: (current: AppSettings) => AppSettings) => void;
  queueSaveSettings: (next: AppSettings) => Promise<AppSettings>;
};

function normalizeComposerPref(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function usePersistComposerSettings({
  enabled,
  appSettingsLoading,
  selectionReady,
  selectedModelId,
  selectedEffort,
  persistModelId = true,
  persistEffort = true,
  setAppSettings,
  queueSaveSettings,
}: Params) {
  useEffect(() => {
    if (!enabled || appSettingsLoading || !selectionReady) {
      return;
    }
    if (!persistModelId && !persistEffort) {
      return;
    }
    setAppSettings((current) => {
      // null / "" / undefined 归一，避免 preferred 回写抖动叠满 useModels layout
      const currentModelId = normalizeComposerPref(current.lastComposerModelId);
      const currentEffort = normalizeComposerPref(current.lastComposerReasoningEffort);
      const nextModelId = persistModelId
        ? normalizeComposerPref(selectedModelId)
        : currentModelId;
      const nextEffort = persistEffort
        ? normalizeComposerPref(selectedEffort)
        : currentEffort;
      if (currentModelId === nextModelId && currentEffort === nextEffort) {
        return current;
      }
      const nextSettings = {
        ...current,
        lastComposerModelId: nextModelId,
        lastComposerReasoningEffort: nextEffort,
      };
      void queueSaveSettings(nextSettings);
      return nextSettings;
    });
  }, [
    enabled,
    appSettingsLoading,
    selectionReady,
    persistEffort,
    persistModelId,
    queueSaveSettings,
    selectedEffort,
    selectedModelId,
    setAppSettings,
  ]);
}
