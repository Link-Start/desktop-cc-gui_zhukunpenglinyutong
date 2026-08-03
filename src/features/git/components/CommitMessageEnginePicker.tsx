import Check from "lucide-react/dist/esm/icons/check";
import History from "lucide-react/dist/esm/icons/history";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { LastCommitMessageConfig } from "../../../utils/commitMessage";
import { EngineIcon } from "../../engine/components/EngineIcon";
import { formatCommitMessageEngineName } from "../utils/commitMessageEngineLabels";

type CommitMessageEngine = LastCommitMessageConfig["engine"];
type CommitMessageLanguage = LastCommitMessageConfig["language"];

type CommitMessageEnginePickerProps = {
  engines: CommitMessageEngine[];
  initialLanguage: CommitMessageLanguage;
  initialEngine?: CommitMessageEngine;
  lastConfig: LastCommitMessageConfig | null;
  onGenerate: (
    language: CommitMessageLanguage,
    engine: CommitMessageEngine,
  ) => void;
  onDismiss: () => void;
  onSelectionChange?: (
    language: CommitMessageLanguage,
    engine: CommitMessageEngine,
  ) => void;
};

function resolveLanguageLabel(
  language: CommitMessageLanguage,
  chineseLabel: string,
  englishLabel: string,
): string {
  return language === "zh" ? chineseLabel : englishLabel;
}

export function CommitMessageEnginePicker({
  engines,
  initialLanguage,
  initialEngine,
  lastConfig,
  onGenerate,
  onDismiss,
  onSelectionChange,
}: CommitMessageEnginePickerProps) {
  const { t } = useTranslation();
  const [language, setLanguage] =
    useState<CommitMessageLanguage>(initialLanguage);
  const [selectedEngine, setSelectedEngine] = useState<CommitMessageEngine>(
    () =>
      initialEngine && engines.includes(initialEngine)
        ? initialEngine
        : (engines[0] ?? "claude"),
  );

  const chineseTranslation = t("settings.languageChinese");
  const englishTranslation = t("settings.languageEnglish");
  const chineseLabel =
    chineseTranslation === "settings.languageChinese"
      ? "中文"
      : chineseTranslation;
  const englishLabel =
    englishTranslation === "settings.languageEnglish"
      ? "English"
      : englishTranslation;

  const enginesLabelRaw = t("git.commitMessageAvailableEngines");
  const enginesLabel =
    enginesLabelRaw === "git.commitMessageAvailableEngines"
      ? "Engines"
      : enginesLabelRaw;
  const emptyTranslation = t("settings.cliGroupEnabledEmpty");
  const emptyLabel =
    emptyTranslation === "settings.cliGroupEnabledEmpty"
      ? "No enabled engines"
      : emptyTranslation;
  const generateWithConfigLabelRaw = t("git.generateCommitMessageWithConfig");
  const generateWithConfigLabel =
    generateWithConfigLabelRaw === "git.generateCommitMessageWithConfig"
      ? "Generate with this config"
      : generateWithConfigLabelRaw;
  const languageLabel =
    t("settings.language") === "settings.language"
      ? "Language"
      : t("settings.language");
  const lastConfigLabel = t("git.generateCommitMessageLastConfig");

  const generate = (
    selectedLanguage: CommitMessageLanguage,
    engine: CommitMessageEngine,
  ) => {
    onDismiss();
    onGenerate(selectedLanguage, engine);
  };

  const selectLanguage = (nextLanguage: CommitMessageLanguage) => {
    setLanguage(nextLanguage);
    onSelectionChange?.(nextLanguage, selectedEngine);
  };

  const selectEngine = (engine: CommitMessageEngine) => {
    setSelectedEngine(engine);
    onSelectionChange?.(language, engine);
  };

  const canGenerate = engines.length > 0 && Boolean(selectedEngine);
  const canUseLastConfig =
    lastConfig !== null && engines.includes(lastConfig.engine);
  const lastConfigTitle =
    canUseLastConfig && lastConfig
      ? `${formatCommitMessageEngineName(lastConfig.engine)} · ${resolveLanguageLabel(
          lastConfig.language,
          chineseLabel,
          englishLabel,
        )}`
      : undefined;

  return (
    <section
      className="commit-message-engine-picker"
      aria-label={t("git.generateCommitMessage")}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <header className="commit-message-engine-picker__header">
        <div className="commit-message-engine-picker__header-title">
          <Sparkles size={12} strokeWidth={2.1} aria-hidden="true" />
          <span>{t("git.generateCommitMessage")}</span>
        </div>
        <div
          className="commit-message-engine-picker__languages"
          role="group"
          aria-label={languageLabel}
        >
          {(
            [
              ["zh", chineseLabel],
              ["en", englishLabel],
            ] as const
          ).map(([value, label]) => {
            const selected = language === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                className="commit-message-engine-picker__language"
                data-selected={selected ? "true" : "false"}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  selectLanguage(value);
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="commit-message-engine-picker__section-label">
        <span>{enginesLabel}</span>
      </div>

      {engines.length > 0 ? (
        <div
          className="commit-message-engine-picker__engines"
          role="radiogroup"
          aria-label={enginesLabel}
        >
          {engines.map((engine) => {
            const engineName = formatCommitMessageEngineName(engine);
            const selected = selectedEngine === engine;
            return (
              <button
                key={engine}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={engineName}
                className="commit-message-engine-picker__engine"
                data-selected={selected ? "true" : "false"}
                onClick={() => selectEngine(engine)}
              >
                <span className="commit-message-engine-picker__engine-icon">
                  <EngineIcon engine={engine} />
                </span>
                <span className="commit-message-engine-picker__engine-name">
                  {engineName}
                </span>
                <span
                  className="commit-message-engine-picker__engine-check"
                  aria-hidden="true"
                  data-visible={selected ? "true" : "false"}
                >
                  <Check size={12} strokeWidth={2.75} />
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="commit-message-engine-picker__empty">{emptyLabel}</div>
      )}

      <div className="commit-message-engine-picker__footer">
        <button
          type="button"
          className="commit-message-engine-picker__last"
          aria-label={
            lastConfigTitle
              ? `${lastConfigLabel}：${lastConfigTitle}`
              : lastConfigLabel
          }
          title={lastConfigTitle}
          disabled={!canUseLastConfig}
          onClick={() => {
            if (!canUseLastConfig || !lastConfig) {
              return;
            }
            generate(lastConfig.language, lastConfig.engine);
          }}
        >
          <History size={13} strokeWidth={2.1} aria-hidden="true" />
          <span>{lastConfigLabel}</span>
        </button>
        <button
          type="button"
          className="commit-message-engine-picker__generate"
          disabled={!canGenerate}
          onClick={() => {
            if (!canGenerate) {
              return;
            }
            generate(language, selectedEngine);
          }}
        >
          <Sparkles size={13} strokeWidth={2.1} aria-hidden="true" />
          <span>{generateWithConfigLabel}</span>
        </button>
      </div>
    </section>
  );
}
