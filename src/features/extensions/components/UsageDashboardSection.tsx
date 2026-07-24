import BarChart3 from "lucide-react/dist/esm/icons/bar-chart-3";
import { lazy, Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import { useTokenTrackerServer } from "../hooks/useTokenTrackerServer";

// 整个 vendored dashboard（含 motion / @base-ui 依赖）隔离在异步 chunk。
const LazyTokenTrackerDashboard = lazy(() => import("./TokenTrackerDashboardView"));

const TT_LOCALE_STORAGE_KEY = "tokentracker-locale";
const TT_THEME_STORAGE_KEY = "tokentracker-theme";
const TT_INSTALL_COMMAND = "npm i -g tokentracker-cli";

/** 宿主 app 语言 → vendored dashboard locale（tokentracker-locale）。 */
function mapAppLanguageToTtLocale(language: string | undefined): string {
  switch (language) {
    case "zh":
      return "zh-CN";
    case "zh-TW":
      return "zh-TW";
    case "ja":
      return "ja";
    case "ko":
      return "ko";
    case "de":
      return "de";
    default:
      return "en";
  }
}

/** documentElement[data-theme] → vendored dashboard theme（tokentracker-theme）。 */
function readAppTheme(): "light" | "dark" | "system" {
  if (typeof document === "undefined") return "system";
  const value = document.documentElement.dataset.theme;
  if (value === "dark" || value === "dim") return "dark";
  if (value === "light") return "light";
  return "system";
}

/** 跟随宿主 app 主题（useThemePreference 写 data-theme；system 时该属性缺省）。 */
function useAppTheme(): "light" | "dark" | "system" {
  const [theme, setTheme] = useState(readAppTheme);
  useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => {
      setTheme(readAppTheme());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);
  return theme;
}

/**
 * 在渲染 dashboard 前同步桥接值。vendored LocaleProvider / ThemeProvider 只在
 * mount 时读一次 localStorage，所以这里同步写 + 调用方用 key 强制 remount。
 */
function syncBridgeStorage(ttLocale: string, ttTheme: string): void {
  try {
    localStorage.setItem(TT_LOCALE_STORAGE_KEY, ttLocale);
    localStorage.setItem(TT_THEME_STORAGE_KEY, ttTheme);
  } catch {
    // localStorage 不可用（如隐私模式）时由 dashboard 自身默认值兜底。
  }
}

function UsageStatus({ label }: { label: string }) {
  return (
    <div className="extensions-usage-status" role="status">
      <span
        className="codicon codicon-loading codicon-modifier-spin"
        aria-hidden
      />
      <p>{label}</p>
    </div>
  );
}

export function UsageDashboardSection() {
  const { t, i18n } = useTranslation();
  const { state, retry, install } = useTokenTrackerServer();
  const appTheme = useAppTheme();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopyInstallCommand = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(TT_INSTALL_COMMAND);
      setCopied(true);
    } catch {
      // 剪贴板被拒（权限 / 非安全上下文）时保持原状，不打断引导流程。
    }
  };

  if (state.status === "checking") {
    return (
      <div className="extensions-usage-section">
        <UsageStatus label={t("extensions.usage.checkingLabel")} />
      </div>
    );
  }

  if (state.status === "installing") {
    return (
      <div className="extensions-usage-section">
        <div className="extensions-usage-card">
          <div className="extensions-usage-progress" role="status">
            <span
              className="codicon codicon-loading codicon-modifier-spin"
              aria-hidden
            />
            <strong>{t("extensions.usage.installingLabel")}</strong>
          </div>
          <p>{t("extensions.usage.installingDesc")}</p>
        </div>
      </div>
    );
  }

  if (state.status === "starting") {
    return (
      <div className="extensions-usage-section">
        <UsageStatus label={t("extensions.usage.startingLabel")} />
      </div>
    );
  }

  if (state.status === "guide") {
    return (
      <div className="extensions-usage-section">
        <div className="extensions-usage-card">
          <div className="extensions-usage-card-icon" aria-hidden>
            <BarChart3 size={20} />
          </div>
          <h2>{t("extensions.usage.guideTitle")}</h2>
          <p>{t("extensions.usage.guideDesc")}</p>
          <div className="extensions-usage-install">
            <span className="extensions-usage-install-label">
              {t("extensions.usage.guideInstallLabel")}
            </span>
            <code>{TT_INSTALL_COMMAND}</code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void handleCopyInstallCommand()}
            >
              {copied
                ? t("extensions.usage.guideCopied")
                : t("extensions.usage.guideCopy")}
            </Button>
            <Button type="button" size="sm" onClick={install}>
              {t("extensions.usage.guideInstallNow")}
            </Button>
          </div>
          <p className="extensions-usage-card-note">
            {t("extensions.usage.guideNoteHooks")}
          </p>
          <p className="extensions-usage-card-note">
            {t("extensions.usage.guideNoteTelemetry")}
          </p>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="extensions-usage-section">
        <div className="extensions-usage-card">
          <h2>{t("extensions.usage.errorTitle")}</h2>
          <code className="extensions-usage-error-detail">{state.message}</code>
          <div className="extensions-usage-card-actions">
            <Button type="button" size="sm" onClick={retry}>
              {t("extensions.usage.errorRetry")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const ttLocale = mapAppLanguageToTtLocale(i18n.language);
  syncBridgeStorage(ttLocale, appTheme);

  return (
    <div className="extensions-usage-section">
      <div
        key={`${ttLocale}:${appTheme}`}
        className="extensions-usage-dashboard"
      >
        <Suspense
          fallback={
            <UsageStatus label={t("extensions.usage.startingLabel")} />
          }
        >
          <LazyTokenTrackerDashboard />
        </Suspense>
      </div>
    </div>
  );
}
