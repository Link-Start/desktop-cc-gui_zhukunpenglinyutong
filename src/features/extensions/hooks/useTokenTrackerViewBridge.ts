import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const TT_LOCALE_STORAGE_KEY = "tokentracker-locale";
const TT_THEME_STORAGE_KEY = "tokentracker-theme";

/** 宿主 app 语言 → vendored dashboard locale（tokentracker-locale）。 */
export function mapAppLanguageToTtLocale(language: string | undefined): string {
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

/**
 * vendored TokenTracker 页面（usage / skills）的 locale/theme 桥接：
 * 渲染前把宿主语言与主题写入 localStorage，并返回 remount key
 * （`${ttLocale}:${appTheme}`，变化时强制 vendored tree 重新 mount）。
 * TokenTrackerServerGate 与 SkillsDashboardSection 共用。
 */
export function useTokenTrackerViewBridge(): { remountKey: string } {
  const { i18n } = useTranslation();
  const appTheme = useAppTheme();
  const ttLocale = mapAppLanguageToTtLocale(i18n.language);
  syncBridgeStorage(ttLocale, appTheme);
  return { remountKey: `${ttLocale}:${appTheme}` };
}
