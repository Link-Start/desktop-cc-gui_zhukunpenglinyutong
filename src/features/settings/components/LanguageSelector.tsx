import { useTranslation } from "react-i18next";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import {
  SUPPORTED_LANGUAGES,
  saveLanguage,
  type SupportedLanguage,
} from "../../../i18n";

const supportedCodes = new Set<SupportedLanguage>(
  SUPPORTED_LANGUAGES.map((entry) => entry.code),
);

/**
 * Maps the active i18next language (which may carry a region suffix like
 * "en-US") onto one of our supported codes, defaulting to Simplified Chinese.
 */
export function resolveCurrentLanguage(
  language: string | undefined,
): SupportedLanguage {
  const raw = language ?? "";
  if (supportedCodes.has(raw as SupportedLanguage)) {
    return raw as SupportedLanguage;
  }
  const primary = raw.split("-")[0]?.toLowerCase();
  const match = SUPPORTED_LANGUAGES.find(
    (entry) => entry.code.split("-")[0]?.toLowerCase() === primary,
  );
  return match?.code ?? "zh";
}

export function LanguageSelector() {
  const { t, i18n } = useTranslation();
  const currentLanguage = resolveCurrentLanguage(i18n.language);

  const handleLanguageChange = (newLang: string) => {
    if (newLang === currentLanguage) {
      return;
    }
    void i18n.changeLanguage(newLang);
    saveLanguage(newLang);
  };

  return (
    <div className="settings-pref-row">
      <div className="settings-pref-meta">
        <div className="settings-pref-title">{t("settings.language")}</div>
        <div className="settings-pref-desc">
          {t("settings.languageDesc", {
            defaultValue: "切换应用界面显示语言。",
          })}
        </div>
      </div>
      <div className="settings-pref-control">
        <div className="settings-pref-select-wrap">
          <select
            className="settings-pref-select"
            aria-label={t("settings.language")}
            value={currentLanguage}
            onChange={(event) => handleLanguageChange(event.target.value)}
          >
            {SUPPORTED_LANGUAGES.map((entry) => (
              <option key={entry.code} value={entry.code}>
                {entry.nativeName}
              </option>
            ))}
          </select>
          <ChevronDown className="settings-pref-select-icon" aria-hidden />
        </div>
      </div>
    </div>
  );
}
