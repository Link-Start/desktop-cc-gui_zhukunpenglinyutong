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
import { scheduleWhenBrowserIdle } from "../../../utils/interactiveMainThread";

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
    // CSS `zoom` carries uiScale; native webview zoom is pinned to 1 once.
    // setZoom(≠1) and transform+fill freezes are documented in
    // docs/analysis/windows-ccgui-startup-hang-2026-08-05.md.
    //
    // Cold-start deferral (2026-08-07 field): uiScale=0.8 + early clicks during
    // sidebar list loading still froze WebView2. Stay at identity until the
    // cold-start window ends, then apply the stored scale. Waiting without
    // clicking was already OK; this removes the "click during loading" path.
    //
    // Startup guard: previous unhealthy ≠1 session → force 1 this session only
    // (never rewrite settings).
    let effectiveScale = uiScale;
    let forcedIdentity = false;
    if (uiScale !== 1 && shouldForceUiScaleIdentity()) {
      effectiveScale = 1;
      forcedIdentity = true;
    }
    let setNativeZoom: ((factor: number) => Promise<void>) | undefined;
    try {
      const webview = getCurrentWebview();
      setNativeZoom = (factor) => webview.setZoom(factor);
    } catch {
      setNativeZoom = undefined;
    }

    let cancelled = false;
    const apply = (scale: number) => {
      if (cancelled) {
        return;
      }
      void applyUiScaleToDocument(scale, { setNativeZoom }).catch(
        () => undefined,
      );
    };

    // Phase 1: always identity first (safe for WebView2 + cold-start clicks).
    apply(1);
    confirmUiScaleHealthy();

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
      return () => {
        cancelled = true;
      };
    }

    if (effectiveScale === 1) {
      return () => {
        cancelled = true;
      };
    }

    // Phase 2: apply user scale on idle (not a hard quiet period that piles work).
    // Prefer idle so clicks during load are not competing with zoom style changes.
    const isTest =
      typeof import.meta !== "undefined" &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (import.meta as any).env?.MODE === "test";

    let cancelIdle: (() => void) | undefined;
    if (isTest) {
      const t = window.setTimeout(() => {
        if (cancelled) return;
        apply(effectiveScale);
        markUiScalePending(effectiveScale);
      }, 0);
      cancelIdle = () => window.clearTimeout(t);
    } else {
      cancelIdle = scheduleWhenBrowserIdle(
        () => {
          if (cancelled) return;
          apply(effectiveScale);
          markUiScalePending(effectiveScale);
        },
        { minDelayMs: 800, timeoutMs: 3_000 },
      );
    }

    return () => {
      cancelled = true;
      cancelIdle?.();
    };
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
