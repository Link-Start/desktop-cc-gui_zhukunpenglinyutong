import {
  useEffect,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useTranslation } from "react-i18next";
import FileText from "lucide-react/dist/esm/icons/file-text";
import Pencil from "lucide-react/dist/esm/icons/pencil";
import { Button } from "@/components/ui/button";
import {
  writeGlobalCodexAuthJson,
  writeGlobalCodexConfigToml,
} from "../../../services/tauri";

interface CurrentCodexGlobalConfigCardProps {
  configLoading: boolean;
  configExists: boolean;
  configContent: string;
  configTruncated: boolean;
  configError: string | null;
  authLoading: boolean;
  authExists: boolean;
  authContent: string;
  authTruncated: boolean;
  authError: string | null;
  onSaved?: () => void | Promise<void>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const SENSITIVE_KEY_PATTERN =
  /(access[_-]?token|refresh[_-]?token|id[_-]?token|api[_-]?key|password|secret)/i;

function maskSecret(raw: string): string {
  if (!raw) {
    return "";
  }
  const trimmed = raw.trim();
  if (trimmed.length <= 8) {
    return "*".repeat(trimmed.length);
  }
  return `${trimmed.slice(0, 4)}${"*".repeat(8)}${trimmed.slice(-2)}`;
}

function redactAuthValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactAuthValue(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  const output: Record<string, unknown> = {};
  for (const [key, nested] of entries) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      output[key] = typeof nested === "string" ? maskSecret(nested) : "***";
      continue;
    }
    output[key] = redactAuthValue(nested);
  }
  return output;
}

function redactAuthContent(content: string): string {
  if (!content.trim()) {
    return content;
  }

  try {
    const parsed = JSON.parse(content) as unknown;
    const redacted = redactAuthValue(parsed);
    return JSON.stringify(redacted, null, 2);
  } catch {
    return content.replace(
      /("?(?:access[_-]?token|refresh[_-]?token|id[_-]?token|api[_-]?key|password|secret)"?\s*:\s*)"([^"]*)"/gi,
      (_match, prefix, value) => `${prefix}"${maskSecret(String(value))}"`,
    );
  }
}

export function CurrentCodexGlobalConfigCard({
  configLoading,
  configExists,
  configContent,
  configTruncated,
  configError,
  authLoading,
  authExists,
  authContent,
  authTruncated,
  authError,
  onSaved,
}: CurrentCodexGlobalConfigCardProps) {
  const { t } = useTranslation();
  const [editOpen, setEditOpen] = useState(false);
  const [configDraft, setConfigDraft] = useState(configContent);
  const [authDraft, setAuthDraft] = useState(authContent);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [authSensitiveVisible, setAuthSensitiveVisible] = useState(false);

  useEffect(() => {
    if (!editOpen) {
      return;
    }
    setConfigDraft(configContent);
    setAuthDraft(authContent);
    setSaveError("");
    setAuthSensitiveVisible(false);
  }, [authContent, configContent, editOpen]);

  useEffect(() => {
    if (!editOpen) {
      return;
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        setEditOpen(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [editOpen]);

  const loading = configLoading || authLoading;
  const truncated = configTruncated || authTruncated;
  const firstStatus =
    loading
      ? t("settings.loading")
      : configError
        ? `${t("settings.vendor.codexGlobalConfigReadFailed")}: ${configError}`
        : authError
          ? `${t("settings.vendor.codexAuthConfigReadFailed")}: ${authError}`
          : truncated
            ? [
                configTruncated
                  ? t("settings.vendor.codexGlobalConfigTruncated")
                  : null,
                authTruncated ? t("settings.vendor.codexAuthConfigTruncated") : null,
              ]
                .filter(Boolean)
                .join(" ")
            : !configExists && !authExists
              ? `${t("settings.vendor.codexGlobalConfigEmpty")} ${t(
                  "settings.vendor.codexAuthConfigEmpty",
                )}`
              : `${t("settings.vendor.currentCodexGlobalConfig")} · ${t(
                  "settings.vendor.currentCodexAuthConfig",
                )}`;

  const handleEditorKeyDown = (
    event: ReactKeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (event.key !== "Tab") {
      return;
    }

    event.preventDefault();
    const target = event.currentTarget;
    const { selectionStart, selectionEnd, value } = target;
    const nextValue = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`;
    const setDraft = target.dataset.codexEditor === "auth" ? setAuthDraft : setConfigDraft;
    setDraft(nextValue);

    requestAnimationFrame(() => {
      const cursorPosition = selectionStart + 2;
      target.setSelectionRange(cursorPosition, cursorPosition);
    });
  };

  const handleSave = async () => {
    if (authDraft.trim()) {
      try {
        const parsed = JSON.parse(authDraft);
        if (!isJsonObject(parsed)) {
          setSaveError(t("settings.vendor.dialog.jsonError"));
          return;
        }
      } catch {
        setSaveError(t("settings.vendor.dialog.jsonError"));
        return;
      }
    }

    const configChanged = configDraft !== configContent;
    // Never write auth.json with an empty draft: that would wipe credentials.
    const authChanged = authDraft !== authContent && authDraft.trim() !== "";

    if (!configChanged && !authChanged) {
      setEditOpen(false);
      return;
    }

    setSaving(true);
    setSaveError("");
    try {
      const writes: Array<{ label: string; run: () => Promise<void> }> = [];
      if (configChanged) {
        writes.push({
          label: t("settings.vendor.codexGlobalConfigWriteFailed"),
          run: () => writeGlobalCodexConfigToml(configDraft),
        });
      }
      if (authChanged) {
        writes.push({
          label: t("settings.vendor.codexAuthConfigWriteFailed"),
          run: () => writeGlobalCodexAuthJson(authDraft),
        });
      }

      const results = await Promise.allSettled(writes.map((write) => write.run()));
      const failures = results
        .map((result, index) =>
          result.status === "rejected"
            ? `${writes[index].label}: ${errorMessage(result.reason)}`
            : null,
        )
        .filter((message): message is string => Boolean(message));

      if (failures.length > 0) {
        // Partial success still refreshes the on-disk snapshot upstream.
        if (failures.length < writes.length) {
          await onSaved?.();
        }
        setSaveError(failures.join(" · "));
        return;
      }

      await onSaved?.();
      setEditOpen(false);
    } catch (error) {
      setSaveError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="vendor-current-config vendor-codex-global-config">
        <div className="vendor-codex-official-config-row">
          <div className="vendor-codex-official-config-main">
            <FileText size={16} aria-hidden />
            <div className="vendor-codex-official-config-copy">
              <div className="vendor-current-config-title">
                {t("settings.vendor.officialConfig")}
              </div>
              <div className="settings-help">{firstStatus}</div>
            </div>
          </div>
          <div className="vendor-codex-official-config-actions">
            <span className="vendor-codex-official-status">
              <span aria-hidden className="size-1.5 rounded-full bg-emerald-500" />
              {t("settings.vendor.inUse")}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              title={t("settings.vendor.edit")}
              aria-label={t("settings.vendor.edit")}
              onClick={() => setEditOpen(true)}
            >
              <Pencil aria-hidden />
            </Button>
          </div>
        </div>
      </div>

      {editOpen ? (
        <div className="vendor-dialog-overlay" role="dialog" aria-modal="true">
          <div className="vendor-dialog vendor-dialog-wide vendor-official-json-dialog">
            <div className="vendor-dialog-header">
              <h3>{t("settings.vendor.officialConfig")}</h3>
              <button
                type="button"
                className="vendor-dialog-close"
                onClick={() => setEditOpen(false)}
                aria-label={t("common.close")}
              >
                ×
              </button>
            </div>

            <div className="vendor-dialog-body vendor-codex-official-dialog-body">
              <div className="vendor-json-section">
                <div className="vendor-codex-official-editor-heading">
                  <span className="vendor-current-config-title">
                    {t("settings.vendor.currentCodexGlobalConfig")}
                  </span>
                  <code className="vendor-codex-global-config-path">
                    {t("settings.vendor.codexGlobalConfigPath")}
                  </code>
                </div>
                <textarea
                  className="vendor-json-editor vendor-official-json-editor"
                  aria-label={t("settings.vendor.currentCodexGlobalConfig")}
                  value={loading ? t("settings.loading") : configDraft}
                  onChange={(event) => {
                    setConfigDraft(event.target.value);
                    setSaveError("");
                  }}
                  onKeyDown={handleEditorKeyDown}
                  rows={10}
                  disabled={loading || saving}
                  spellCheck={false}
                />
              </div>

              <div className="vendor-json-section">
                <div className="vendor-codex-official-editor-heading">
                  <span className="vendor-current-config-title">
                    {t("settings.vendor.currentCodexAuthConfig")}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setAuthSensitiveVisible((value) => !value)}
                  >
                    {authSensitiveVisible
                      ? t("settings.vendor.codexAuthConfigHideSensitive")
                      : t("settings.vendor.codexAuthConfigShowSensitive")}
                  </Button>
                  <code className="vendor-codex-global-config-path">
                    {t("settings.vendor.codexAuthConfigPath")}
                  </code>
                </div>
                <textarea
                  className="vendor-json-editor vendor-official-json-editor"
                  aria-label={t("settings.vendor.currentCodexAuthConfig")}
                  data-codex-editor="auth"
                  value={
                    loading
                      ? t("settings.loading")
                      : authSensitiveVisible
                        ? authDraft
                        : redactAuthContent(authDraft)
                  }
                  onChange={(event) => {
                    if (!authSensitiveVisible) {
                      return;
                    }
                    setAuthDraft(event.target.value);
                    setSaveError("");
                  }}
                  onKeyDown={handleEditorKeyDown}
                  rows={10}
                  readOnly={!authSensitiveVisible}
                  disabled={loading || saving}
                  spellCheck={false}
                />
              </div>

              {truncated ? (
                <div className="vendor-json-error">
                  {[
                    configTruncated
                      ? t("settings.vendor.codexGlobalConfigTruncated")
                      : null,
                    authTruncated
                      ? t("settings.vendor.codexAuthConfigTruncated")
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                </div>
              ) : null}
              {configError ? (
                <div className="vendor-json-error">
                  {t("settings.vendor.codexGlobalConfigReadFailed")}: {configError}
                </div>
              ) : null}
              {authError ? (
                <div className="vendor-json-error">
                  {t("settings.vendor.codexAuthConfigReadFailed")}: {authError}
                </div>
              ) : null}
              {saveError ? <div className="vendor-json-error">{saveError}</div> : null}
            </div>

            <div className="vendor-dialog-footer">
              <button
                type="button"
                className="vendor-btn-cancel"
                onClick={() => setEditOpen(false)}
                disabled={saving}
              >
                {t("settings.vendor.cancel")}
              </button>
              <button
                type="button"
                className="vendor-btn-save"
                onClick={handleSave}
                disabled={loading || saving || truncated}
              >
                {t("settings.vendor.dialog.saveChanges")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
