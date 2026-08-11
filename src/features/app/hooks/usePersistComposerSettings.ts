import { useEffect } from "react";
import type { AppSettings } from "../../../types";

type Params = {
  enabled: boolean;
  appSettingsLoading: boolean;
  selectionReady: boolean;
  selectedModelId: string | null;
  selectedEffort: string | null;
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
  setAppSettings,
  queueSaveSettings,
}: Params) {
  useEffect(() => {
    if (!enabled || appSettingsLoading || !selectionReady) {
      return;
    }
    setAppSettings((current) => {
      // null / "" / undefined 归一，避免 preferred 回写抖动叠满 useModels layout
      const nextModelId = normalizeComposerPref(selectedModelId);
      const nextEffort = normalizeComposerPref(selectedEffort);
      const currentModelId = normalizeComposerPref(current.lastComposerModelId);
      const currentEffort = normalizeComposerPref(current.lastComposerReasoningEffort);
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
    queueSaveSettings,
    selectedEffort,
    selectedModelId,
    setAppSettings,
  ]);
}
