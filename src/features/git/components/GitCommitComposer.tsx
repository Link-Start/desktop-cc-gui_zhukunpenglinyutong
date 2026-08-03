import Check from "lucide-react/dist/esm/icons/check";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type {
  CommitMessageEngine,
  CommitMessageLanguage,
} from "../../../services/tauri";
import { getDisabledCliEngineIdsSnapshot } from "../../composer/hooks/cliEngineVisibilityStore";
import { formatCommitMessageEngineName } from "../utils/commitMessageEngineLabels";
import {
  readCommitMessageMenuPreferences,
  type CommitMessageMenuPreferences,
} from "../utils/commitMessageMenuConfig";
import type { GitCommitComposerPlacement } from "../hooks/useGitCommitComposerPlacement";
import { CommitMessageEngineIcon } from "./CommitMessageEngineIcon";
import { CommitMessageEnginePicker } from "./CommitMessageEnginePicker";

export type GitCommitComposerProps = {
  commitMessage: string;
  onCommitMessageChange?: (value: string) => void;
  selectedCount: number;
  hasAnyChanges?: boolean;
  canGenerate: boolean;
  commitLoading: boolean;
  commitMessageLoading?: boolean;
  commitError?: string | null;
  commitMessageError?: string | null;
  extraErrors?: Array<string | null | undefined>;
  hint: string;
  placement?: GitCommitComposerPlacement;
  engine: CommitMessageEngine;
  onEngineChange?: (engine: CommitMessageEngine) => void;
  onGenerate: (
    language: CommitMessageLanguage,
    engine: CommitMessageEngine,
  ) => void | Promise<void>;
  onCommit: () => void | Promise<void>;
  className?: string;
  footerExtra?: ReactNode;
  /** Prefer last-config for one-click regenerate when available. */
  preferences?: CommitMessageMenuPreferences;
};

function languageShortLabel(language: CommitMessageLanguage): string {
  return language === "zh" ? "中" : "EN";
}

export function GitCommitComposer({
  commitMessage,
  onCommitMessageChange,
  selectedCount,
  hasAnyChanges = true,
  canGenerate,
  commitLoading,
  commitMessageLoading = false,
  commitError,
  commitMessageError,
  extraErrors,
  hint,
  placement = "bottom",
  engine,
  onEngineChange,
  onGenerate,
  onCommit,
  className,
  footerExtra,
  preferences: preferencesProp,
}: GitCommitComposerProps) {
  const { t } = useTranslation();
  const [configOpen, setConfigOpen] = useState(false);
  const [language, setLanguage] = useState<CommitMessageLanguage>("zh");
  const [preferences, setPreferences] = useState<CommitMessageMenuPreferences>(
    () =>
      preferencesProp ??
      readCommitMessageMenuPreferences(getDisabledCliEngineIdsSnapshot()),
  );

  useEffect(() => {
    if (preferencesProp) {
      setPreferences(preferencesProp);
      return;
    }
    if (configOpen) {
      setPreferences(
        readCommitMessageMenuPreferences(getDisabledCliEngineIdsSnapshot()),
      );
    }
  }, [configOpen, preferencesProp]);

  useEffect(() => {
    setLanguage(preferences.initialLanguage);
  }, [preferences.initialLanguage]);

  const displayEngine = useMemo(() => {
    if (preferences.engines.includes(engine)) {
      return engine;
    }
    return preferences.engines[0] ?? engine;
  }, [engine, preferences.engines]);

  // Keep parent engine aligned with currently visible engines (e.g. after CLI hide).
  useEffect(() => {
    if (displayEngine !== engine) {
      onEngineChange?.(displayEngine);
    }
  }, [displayEngine, engine, onEngineChange]);

  const hasMessage = commitMessage.trim().length > 0;
  const canCommit = hasMessage && selectedCount > 0 && !commitLoading;
  const busy = commitMessageLoading || commitLoading;
  const canQuickGenerate = canGenerate && !busy;
  const canOpenConfig = canGenerate && !busy;

  const commitTitle = !hasMessage
    ? t("git.enterCommitMessage")
    : selectedCount === 0 && hasAnyChanges
      ? t("git.selectFilesToCommit")
      : !hasAnyChanges
        ? t("git.noChangesToCommit")
        : t("git.commitSelectedChanges");

  const polishedCommitLabel = commitLoading
    ? t("git.committing")
    : selectedCount > 0
      ? `${t("git.commit")} · ${selectedCount}`
      : t("git.commit");

  const chipLabel = `${formatCommitMessageEngineName(displayEngine)} · ${languageShortLabel(
    language,
  )}`;

  const quickTitleRaw = t("git.generateCommitMessageQuick");
  const quickTitle =
    quickTitleRaw === "git.generateCommitMessageQuick"
      ? "Regenerate with current configuration"
      : quickTitleRaw;

  const handleGenerate = (
    nextLanguage: CommitMessageLanguage,
    nextEngine: CommitMessageEngine,
  ) => {
    setLanguage(nextLanguage);
    onEngineChange?.(nextEngine);
    setConfigOpen(false);
    void onGenerate(nextLanguage, nextEngine);
  };

  const handleQuickGenerate = () => {
    if (!canQuickGenerate) {
      return;
    }
    const last = preferences.lastConfig;
    if (last && preferences.engines.includes(last.engine)) {
      handleGenerate(last.language, last.engine);
      return;
    }
    handleGenerate(language, displayEngine);
  };

  const errors = [
    commitMessageError,
    commitError,
    ...(extraErrors ?? []),
  ].filter((value): value is string => Boolean(value && value.trim()));

  const rootClassName = [
    "commit-message-section",
    "git-commit-composer",
    `git-commit-composer--${placement}`,
    "git-commit-composer--layered",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClassName}>
      <div
        className={`commit-message-card${configOpen ? " is-config-open" : ""}${
          busy ? " is-busy" : ""
        }`}
      >
        <textarea
          className="commit-message-input commit-message-input--card"
          placeholder={t("git.commitMessage")}
          value={commitMessage}
          onChange={(event) => onCommitMessageChange?.(event.target.value)}
          disabled={busy}
          rows={2}
        />

        <div className="commit-message-toolbar">
          <div
            className="commit-message-ai-group"
            data-disabled={canOpenConfig || canQuickGenerate ? "false" : "true"}
          >
            <Popover open={configOpen} onOpenChange={setConfigOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={`commit-message-config-chip${
                    commitMessageLoading
                      ? " commit-message-config-chip--loading"
                      : ""
                  }${configOpen ? " is-open" : ""}`}
                  disabled={!canOpenConfig && !configOpen}
                  aria-haspopup="dialog"
                  aria-expanded={configOpen}
                  title={t("git.generateCommitMessage")}
                  aria-label={t("git.generateCommitMessage")}
                >
                  {commitMessageLoading ? (
                    <Sparkles
                      size={13}
                      className="commit-message-engine-icon commit-message-engine-icon--spinning"
                      aria-hidden="true"
                    />
                  ) : (
                    <CommitMessageEngineIcon
                      engine={displayEngine}
                      size={13}
                      className="commit-message-engine-icon"
                    />
                  )}
                  <span className="commit-message-config-chip__label">
                    {commitMessageLoading
                      ? t("git.generatingCommitMessage") ===
                        "git.generatingCommitMessage"
                        ? "Generating…"
                        : t("git.generatingCommitMessage")
                      : chipLabel}
                  </span>
                  <ChevronDown
                    size={12}
                    strokeWidth={2.25}
                    className="commit-message-config-chip__chevron"
                    aria-hidden="true"
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                side={placement === "bottom" ? "top" : "bottom"}
                sideOffset={6}
                collisionPadding={12}
                className="commit-message-config-popover p-0 border-0 shadow-none"
                onOpenAutoFocus={(event) => event.preventDefault()}
              >
                <CommitMessageEnginePicker
                  engines={preferences.engines}
                  initialLanguage={language}
                  initialEngine={displayEngine}
                  lastConfig={
                    preferences.lastConfig &&
                    preferences.engines.includes(preferences.lastConfig.engine)
                      ? preferences.lastConfig
                      : null
                  }
                  onDismiss={() => setConfigOpen(false)}
                  onGenerate={handleGenerate}
                  onSelectionChange={(nextLanguage, nextEngine) => {
                    setLanguage(nextLanguage);
                    onEngineChange?.(nextEngine);
                  }}
                />
              </PopoverContent>
            </Popover>

            <button
              type="button"
              className="commit-message-quick-generate"
              onClick={handleQuickGenerate}
              disabled={!canQuickGenerate}
              title={quickTitle}
              aria-label={quickTitle}
            >
              <Sparkles size={13} strokeWidth={2.1} aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            className="commit-message-commit-primary"
            onClick={() => {
              if (canCommit) {
                void onCommit();
              }
            }}
            disabled={!canCommit}
            title={commitTitle}
            aria-label={commitLoading ? t("git.committing") : t("git.commit")}
          >
            {commitLoading ? (
              <span className="commit-button-spinner" aria-hidden />
            ) : (
              <Check size={13} strokeWidth={2.5} aria-hidden="true" />
            )}
            <span>{polishedCommitLabel}</span>
          </button>
        </div>
      </div>

      {errors.map((message) => (
        <div className="commit-message-error" key={message}>
          {message}
        </div>
      ))}
      {footerExtra}
      <div
        className={`commit-message-hint${
          selectedCount === 0 && hasAnyChanges
            ? " commit-message-hint--warning"
            : ""
        }`}
        aria-live="polite"
      >
        {hint}
      </div>
    </div>
  );
}
