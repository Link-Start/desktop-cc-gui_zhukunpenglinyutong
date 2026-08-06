import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import type { AppSettings } from "../../../types";
import { applyUiScaleToDocument } from "../../../utils/applyUiScale";
import {
  confirmUiScaleHealthy,
  markUiScalePending,
  shouldForceUiScaleIdentity,
} from "../../../utils/uiScaleStartupGuard";
import { appendRendererDiagnostic } from "../../../services/rendererDiagnostics";
import { pushGlobalRuntimeNotice } from "../../../services/globalRuntimeNotices";
import {
  formatShortcutForPlatform,
  isEditableShortcutTarget,
  matchesShortcutForPlatform,
} from "../../../utils/shortcuts";
import { clampUiScale, UI_SCALE_STEP } from "../../../utils/uiScale";

type UseUiScaleShortcutsOptions = {
  settings: AppSettings;
  setSettings: Dispatch<SetStateAction<AppSettings>>;
  saveSettings: (settings: AppSettings) => Promise<AppSettings>;
};

type UseUiScaleShortcutsResult = {
  uiScale: number;
  scaleShortcutTitle: string;
  scaleShortcutText: string;
  queueSaveSettings: (next: AppSettings) => Promise<AppSettings>;
  increaseUiScale: () => void;
  decreaseUiScale: () => void;
  resetUiScale: () => void;
};

export function useUiScaleShortcuts({
  settings,
  setSettings,
  saveSettings,
}: UseUiScaleShortcutsOptions): UseUiScaleShortcutsResult {
  const { t } = useTranslation();
  const uiScale = clampUiScale(settings.uiScale);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }
    // All platforms apply uiScale via CSS transform scale; native webview zoom
    // (WebView2 SetZoomFactor / WKWebView setPageZoom) is pinned to 1 once —
    // native zoom ≠1 has frozen renderers in the field. See
    // docs/analysis/windows-ccgui-startup-hang-2026-08-05.md,
    // openspec/changes/fix-windows-ui-scale-webview2-hang/ and
    // openspec/changes/fix-ui-scale-native-zoom-freeze-all-platforms/.
    //
    // Startup guard: if the previous session applied a non-identity scale and
    // never proved healthy (renderer froze before it could clear the pending
    // record), apply scale 1 for THIS session only — the stored setting is
    // never rewritten, so the user keeps their preference and can retry.
    let effectiveScale = uiScale;
    let forcedIdentity = false;
    if (uiScale !== 1 && shouldForceUiScaleIdentity()) {
      effectiveScale = 1;
      forcedIdentity = true;
    }
    let setNativeZoom: ((factor: number) => Promise<void>) | undefined;
    try {
      // getCurrentWebview() reads window.__TAURI_INTERNALS__.metadata
      // synchronously; missing metadata throws before setZoom's rejection path.
      const webview = getCurrentWebview();
      setNativeZoom = (factor) => webview.setZoom(factor);
    } catch {
      // Non-Tauri runtimes (browser dev server, vitest) skip native zoom.
      setNativeZoom = undefined;
    }
    void applyUiScaleToDocument(effectiveScale, { setNativeZoom }).catch(
      () => undefined,
    );
    if (effectiveScale === 1) {
      confirmUiScaleHealthy();
    } else {
      markUiScalePending(effectiveScale);
    }
    if (forcedIdentity) {
      appendRendererDiagnostic("ui-scale/startup-guard-forced-identity", {
        storedScale: uiScale,
      });
      pushGlobalRuntimeNotice({
        severity: "warning",
        category: "diagnostic",
        messageKey: "runtimeNotice.uiScale.startupGuardReset",
        messageParams: { scale: Math.round(uiScale * 100) },
        dedupeKey: "ui-scale:startup-guard-forced-identity",
      });
    }
  }, [uiScale]);

  const scaleShortcutTitle = useMemo(() => {
    const increase = formatShortcutForPlatform(settings.increaseUiScaleShortcut);
    const decrease = formatShortcutForPlatform(settings.decreaseUiScaleShortcut);
    const reset = formatShortcutForPlatform(settings.resetUiScaleShortcut);
    return t("settings.uiScaleShortcutTitle", {
      increase,
      decrease,
      reset,
    });
  }, [
    settings.decreaseUiScaleShortcut,
    settings.increaseUiScaleShortcut,
    settings.resetUiScaleShortcut,
    t,
  ]);
  const scaleShortcutText = t("settings.uiScaleShortcutText", {
    shortcuts: scaleShortcutTitle,
  });

  const saveQueueRef = useRef(Promise.resolve());
  const queueSaveSettings = useCallback(
    (next: AppSettings) => {
      const task = () => saveSettings(next);
      const queued = saveQueueRef.current.then(task, task);
      saveQueueRef.current = queued.then(
        () => undefined,
        () => undefined,
      );
      return queued;
    },
    [saveSettings],
  );

  const handleScaleDelta = useCallback(
    (delta: number) => {
      setSettings((current) => {
        const nextScale = clampUiScale(current.uiScale + delta);
        if (nextScale === current.uiScale) {
          return current;
        }
        const nextSettings = {
          ...current,
          uiScale: nextScale,
        };
        void queueSaveSettings(nextSettings);
        return nextSettings;
      });
    },
    [queueSaveSettings, setSettings],
  );

  const handleScaleReset = useCallback(() => {
    setSettings((current) => {
      if (current.uiScale === 1) {
        return current;
      }
      const nextSettings = {
        ...current,
        uiScale: 1,
      };
      void queueSaveSettings(nextSettings);
      return nextSettings;
    });
  }, [queueSaveSettings, setSettings]);

  const increaseUiScale = useCallback(
    () => handleScaleDelta(UI_SCALE_STEP),
    [handleScaleDelta],
  );
  const decreaseUiScale = useCallback(
    () => handleScaleDelta(-UI_SCALE_STEP),
    [handleScaleDelta],
  );

  useEffect(() => {
    const handleScaleShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) {
        return;
      }
      if (
        isEditableShortcutTarget(event.target) ||
        isEditableShortcutTarget(document.activeElement)
      ) {
        return;
      }
      const isIncrease = matchesShortcutForPlatform(
        event,
        settings.increaseUiScaleShortcut,
      );
      const isDecrease = matchesShortcutForPlatform(
        event,
        settings.decreaseUiScaleShortcut,
      );
      const isReset = matchesShortcutForPlatform(
        event,
        settings.resetUiScaleShortcut,
      );
      if (!isIncrease && !isDecrease && !isReset) {
        return;
      }
      event.preventDefault();
      if (isReset) {
        handleScaleReset();
        return;
      }
      if (isDecrease) {
        decreaseUiScale();
      } else {
        increaseUiScale();
      }
    };
    window.addEventListener("keydown", handleScaleShortcut);
    return () => {
      window.removeEventListener("keydown", handleScaleShortcut);
    };
  }, [
    decreaseUiScale,
    handleScaleReset,
    increaseUiScale,
    settings.decreaseUiScaleShortcut,
    settings.increaseUiScaleShortcut,
    settings.resetUiScaleShortcut,
  ]);

  return {
    uiScale,
    scaleShortcutTitle,
    scaleShortcutText,
    queueSaveSettings,
    increaseUiScale,
    decreaseUiScale,
    resetUiScale: handleScaleReset,
  };
}
