import { useCallback, useEffect, useState } from "react";
import { FIRST_RUN_SETUP_CHANGE_EVENT } from "../utils/setupEvents";
import {
  isClientStoreReady,
  subscribeClientStoreHydrated,
} from "../../../services/clientStorage";
import { getAppSettings, updateAppSettings } from "../../../services/tauri";
import type { FirstRunIdeId } from "../types";
import {
  applyEditorHabitToAppSettings,
  persistEditorHabit,
} from "../utils/editorHabit";
import { readFirstRunSetupProfile } from "../utils/setupGate";

export function useEditorHabit() {
  const [preferredIde, setPreferredIde] = useState<FirstRunIdeId | null>(() =>
    isClientStoreReady("app") ? readFirstRunSetupProfile().preferredIde : null,
  );

  useEffect(() => {
    const refresh = () => {
      if (!isClientStoreReady("app")) {
        return;
      }
      const next = readFirstRunSetupProfile().preferredIde;
      setPreferredIde((current) => (current === next ? current : next));
    };
    refresh();
    const unsubscribe = subscribeClientStoreHydrated((store) => {
      if (store === "app") {
        refresh();
      }
    });
    window.addEventListener(FIRST_RUN_SETUP_CHANGE_EVENT, refresh);
    return () => {
      unsubscribe();
      window.removeEventListener(FIRST_RUN_SETUP_CHANGE_EVENT, refresh);
    };
  }, []);

  const setEditorHabit = useCallback(async (ide: FirstRunIdeId) => {
    persistEditorHabit(ide);
    setPreferredIde(ide);
    const settings = await getAppSettings();
    const nextSettings = applyEditorHabitToAppSettings(settings, ide);
    if (nextSettings !== settings) {
      await updateAppSettings(nextSettings);
    }
  }, []);

  return {
    preferredIde,
    setEditorHabit,
  };
}
