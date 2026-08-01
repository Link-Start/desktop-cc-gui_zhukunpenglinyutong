import History from "lucide-react/dist/esm/icons/history";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { LastCommitMessageConfig } from "../../../utils/commitMessage";
import { EngineIcon } from "../../engine/components/EngineIcon";

type CommitMessageEngine = LastCommitMessageConfig["engine"];
type CommitMessageLanguage = LastCommitMessageConfig["language"];

type CommitMessageEnginePickerProps = {
  engines: CommitMessageEngine[];
  initialLanguage: CommitMessageLanguage;
  lastConfig: LastCommitMessageConfig | null;
  onGenerate: (
    language: CommitMessageLanguage,
    engine: CommitMessageEngine,
  ) => void;
  onDismiss: () => void;
};

const ENGINE_NAME_OVERRIDES: Partial<
  Record<CommitMessageEngine, string>
> = {
  claude: "Claude Code",
  opencode: "OpenCode",
};

const formatEngineName = (engine: CommitMessageEngine): string =>
  ENGINE_NAME_OVERRIDES[engine] ??
  engine
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export function CommitMessageEnginePicker({
  engines,
  initialLanguage,
  lastConfig,
  onGenerate,
  onDismiss,
}: CommitMessageEnginePickerProps) {
  const { t } = useTranslation();
  const [language, setLanguage] =
    useState<CommitMessageLanguage>(initialLanguage);
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
  const enabledTranslation = t("settings.cliGroupEnabled", {
    count: engines.length,
  });
  const enabledLabel =
    enabledTranslation === "settings.cliGroupEnabled"
      ? `Enabled (${engines.length})`
      : enabledTranslation;
  const emptyTranslation = t("settings.cliGroupEnabledEmpty");
  const emptyLabel =
    emptyTranslation === "settings.cliGroupEnabledEmpty"
      ? "No enabled engines"
      : emptyTranslation;

  const generate = (
    selectedLanguage: CommitMessageLanguage,
    engine: CommitMessageEngine,
  ) => {
    onDismiss();
    onGenerate(selectedLanguage, engine);
  };

  const selectLanguage = (nextLanguage: CommitMessageLanguage) => {
    setLanguage(nextLanguage);
  };

  return (
    <section
      className="commit-message-engine-picker"
      aria-label={t("git.generateCommitMessage")}
      // 自定义 content 嵌在 context menu 内：悬停/按下都不应冒泡到菜单导航层
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="commit-message-engine-picker__quick"
        aria-label={t("git.generateCommitMessageLastConfig")}
        disabled={!lastConfig}
        onClick={() => {
          if (lastConfig) {
            generate(lastConfig.language, lastConfig.engine);
          }
        }}
      >
        <History size={15} aria-hidden="true" />
        <span className="commit-message-engine-picker__quick-copy">
          <strong>{t("git.generateCommitMessageLastConfig")}</strong>
          <small>
            {lastConfig
              ? `${formatEngineName(lastConfig.engine)} · ${
                  lastConfig.language === "zh"
                    ? chineseLabel
                    : englishLabel
                }`
              : emptyLabel}
          </small>
        </span>
      </button>

      <div
        className="commit-message-engine-picker__languages"
        role="group"
        aria-label={t("common.language")}
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
                // 阻止 mousedown 被外层 menu 当作激活/关闭路径吞掉
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

      <div className="commit-message-engine-picker__section-label">
        <span>{enabledLabel}</span>
      </div>

      {engines.length > 0 ? (
        <div className="commit-message-engine-picker__engines">
          {engines.map((engine) => {
            const engineName = formatEngineName(engine);
            return (
              <button
                key={engine}
                type="button"
                aria-label={engineName}
                className="commit-message-engine-picker__engine"
                onClick={() => generate(language, engine)}
              >
                <span className="commit-message-engine-picker__engine-icon">
                  <EngineIcon engine={engine} />
                </span>
                <span className="commit-message-engine-picker__engine-name">
                  {engineName}
                </span>
                <span
                  className="commit-message-engine-picker__enabled-dot"
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="commit-message-engine-picker__empty">{emptyLabel}</div>
      )}
    </section>
  );
}
