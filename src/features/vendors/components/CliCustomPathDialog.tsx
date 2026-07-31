import { useEffect, useState } from "react";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "react-i18next";

export type CliCustomPathEngine =
  | "claude"
  | "codex"
  | "kimi"
  | "grok"
  | "opencode";

export type CliCustomPathSavePayload = {
  path: string | null;
  args?: string | null;
};

type CliCustomPathDialogProps = {
  isOpen: boolean;
  engine: CliCustomPathEngine;
  initialPath: string | null;
  initialArgs?: string | null;
  onSave: (payload: CliCustomPathSavePayload) => Promise<void>;
  onClose: () => void;
};

function normalizeNullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function pathLabelKey(engine: CliCustomPathEngine): string {
  switch (engine) {
    case "claude":
      return "settings.defaultClaudePath";
    case "kimi":
      return "settings.defaultKimiPath";
    case "grok":
      return "settings.defaultGrokPath";
    case "opencode":
      return "settings.defaultOpenCodePath";
    case "codex":
    default:
      return "settings.defaultCodexPath";
  }
}

function pathPlaceholderKey(engine: CliCustomPathEngine): string {
  switch (engine) {
    case "claude":
      return "settings.claudePlaceholder";
    case "kimi":
      return "settings.kimiPlaceholder";
    case "grok":
      return "settings.grokPlaceholder";
    case "opencode":
      return "settings.openCodePlaceholder";
    case "codex":
    default:
      return "settings.codexPlaceholder";
  }
}

export function CliCustomPathDialog({
  isOpen,
  engine,
  initialPath,
  initialArgs = null,
  onSave,
  onClose,
}: CliCustomPathDialogProps) {
  const { t } = useTranslation();
  const supportsArgs = engine === "codex";
  const [pathDraft, setPathDraft] = useState(initialPath ?? "");
  const [argsDraft, setArgsDraft] = useState(initialArgs ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setPathDraft(initialPath ?? "");
    setArgsDraft(initialArgs ?? "");
    setIsSaving(false);
    setError(null);
  }, [initialArgs, initialPath, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, isSaving, onClose]);

  if (!isOpen) {
    return null;
  }

  const nextPath = normalizeNullable(pathDraft);
  const nextArgs = normalizeNullable(argsDraft);
  const dirty =
    nextPath !== (initialPath ?? null) ||
    (supportsArgs && nextArgs !== (initialArgs ?? null));

  const handleBrowse = async () => {
    const selection = await openFileDialog({
      multiple: false,
      directory: false,
    });
    if (!selection || Array.isArray(selection)) {
      return;
    }
    setPathDraft(selection);
  };

  const handleSave = async () => {
    if (!dirty || isSaving) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onSave(
        supportsArgs
          ? { path: nextPath, args: nextArgs }
          : { path: nextPath },
      );
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : String(saveError),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="vendor-dialog-overlay" onClick={() => !isSaving && onClose()}>
      <div
        className="vendor-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cli-custom-path-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="vendor-dialog-header">
          <h3 id="cli-custom-path-dialog-title">
            {t("settings.vendor.customPathTitle")}
          </h3>
        </div>
        <div className="vendor-dialog-body">
          <p className="settings-help">
            {t("settings.vendor.customPathDescription")}
          </p>

          <label className="settings-field-label" htmlFor="cli-custom-path-input">
            {t(pathLabelKey(engine))}
          </label>
          <div className="settings-field-row">
            <input
              id="cli-custom-path-input"
              className="settings-input"
              value={pathDraft}
              placeholder={t(pathPlaceholderKey(engine))}
              onChange={(event) => setPathDraft(event.target.value)}
              disabled={isSaving}
            />
            <button
              type="button"
              className="ghost"
              onClick={() => void handleBrowse()}
              disabled={isSaving}
            >
              {t("settings.browse")}
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => setPathDraft("")}
              disabled={isSaving}
            >
              {t("settings.usePath")}
            </button>
          </div>
          <div className="settings-help">{t("settings.pathResolutionDesc")}</div>

          {supportsArgs ? (
            <>
              <label
                className="settings-field-label"
                htmlFor="cli-custom-args-input"
              >
                {t("settings.defaultCodexArgs")}
              </label>
              <div className="settings-field-row">
                <input
                  id="cli-custom-args-input"
                  className="settings-input"
                  value={argsDraft}
                  placeholder={t("settings.codexArgsPlaceholder")}
                  onChange={(event) => setArgsDraft(event.target.value)}
                  disabled={isSaving}
                />
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setArgsDraft("")}
                  disabled={isSaving}
                >
                  {t("settings.clear")}
                </button>
              </div>
              <div className="settings-help">
                {t("settings.codexArgsDesc")}{" "}
                <code>{t("settings.appServer")}</code>
                {t("settings.codexArgsDescSuffix")}
              </div>
            </>
          ) : null}

          {error ? (
            <div className="settings-help" role="alert">
              {error}
            </div>
          ) : null}
        </div>
        <div className="vendor-dialog-footer">
          <button
            type="button"
            className="vendor-btn-cancel"
            onClick={onClose}
            disabled={isSaving}
          >
            {t("settings.vendor.cancel")}
          </button>
          <button
            type="button"
            className="vendor-btn-save"
            onClick={() => void handleSave()}
            disabled={!dirty || isSaving}
          >
            {isSaving ? t("settings.saving") : t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

type CliCustomPathEntryProps = {
  path: string | null;
  args?: string | null;
  showArgsSummary?: boolean;
  onConfigure: () => void;
};

export function CliCustomPathEntry({
  path,
  args = null,
  showArgsSummary = false,
  onConfigure,
}: CliCustomPathEntryProps) {
  const { t } = useTranslation();
  const summary = path?.trim()
    ? path.trim()
    : t("settings.vendor.customPathUsingSystemPath");
  const argsSummary =
    showArgsSummary && args?.trim()
      ? args.trim()
      : showArgsSummary
        ? t("settings.vendor.customPathNoArgs")
        : null;

  return (
    <div
      className="vendor-group-row vendor-group-row-clickable vendor-custom-path-row"
      onClick={onConfigure}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onConfigure();
        }
      }}
    >
      <div className="vendor-group-row-copy">
        <span className="vendor-group-row-title">
          {t("settings.vendor.customPath")}
        </span>
        <div className="settings-help vendor-custom-path-summary" title={summary}>
          {summary}
        </div>
        {argsSummary ? (
          <div
            className="settings-help vendor-custom-path-summary"
            title={argsSummary}
          >
            {argsSummary}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className="vendor-plugin-models-manage-btn"
        onClick={(event) => {
          event.stopPropagation();
          onConfigure();
        }}
      >
        {t("settings.vendor.configurePath")}
      </button>
    </div>
  );
}
