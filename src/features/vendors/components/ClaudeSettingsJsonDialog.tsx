import {
  useEffect,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useTranslation } from "react-i18next";
import {
  readClaudeSettingsJson,
  saveClaudeSettingsJson,
} from "../../../services/tauri";

interface ClaudeSettingsJsonDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function ClaudeSettingsJsonDialog({
  isOpen,
  onClose,
  onSaved,
}: ClaudeSettingsJsonDialogProps) {
  const { t } = useTranslation();
  const [jsonConfig, setJsonConfig] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setJsonError("");
    void readClaudeSettingsJson()
      .then((content) => {
        if (!cancelled) {
          setJsonConfig(content);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setJsonError(errorMessage(error));
          setJsonConfig("{}");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(jsonConfig || "{}");
      if (!isJsonObject(parsed)) {
        setJsonError(t("settings.vendor.dialog.jsonError"));
        return;
      }
      setJsonConfig(JSON.stringify(parsed, null, 2));
      setJsonError("");
    } catch {
      setJsonError(t("settings.vendor.dialog.jsonError"));
    }
  };

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
    setJsonConfig(nextValue);

    requestAnimationFrame(() => {
      const cursorPosition = selectionStart + 2;
      target.setSelectionRange(cursorPosition, cursorPosition);
    });
  };

  const handleSave = async () => {
    let formatted: string;
    try {
      const parsed = JSON.parse(jsonConfig || "{}");
      if (!isJsonObject(parsed)) {
        setJsonError(t("settings.vendor.dialog.jsonError"));
        return;
      }
      formatted = JSON.stringify(parsed, null, 2);
    } catch {
      setJsonError(t("settings.vendor.dialog.jsonError"));
      return;
    }

    setSaving(true);
    setJsonError("");
    try {
      await saveClaudeSettingsJson(formatted);
      setJsonConfig(formatted);
      onSaved();
      onClose();
    } catch (error: unknown) {
      setJsonError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="vendor-dialog-overlay" role="dialog" aria-modal="true">
      <div className="vendor-dialog vendor-dialog-wide vendor-official-json-dialog">
        <div className="vendor-dialog-header">
          <h3>{t("settings.vendor.localProviderName")}</h3>
          <button
            type="button"
            className="vendor-dialog-close"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            ×
          </button>
        </div>

        <div className="vendor-dialog-body">
          <div className="vendor-json-section">
            <div className="vendor-official-json-heading">
              <p className="vendor-hint vendor-json-description">
                {t("settings.vendor.localProviderDescription")}
              </p>
              <div className="vendor-json-toolbar">
                <button
                  type="button"
                  onClick={handleFormatJson}
                  disabled={loading || saving}
                >
                  {t("settings.vendor.dialog.formatJson")}
                </button>
              </div>
            </div>
            <textarea
              className="vendor-json-editor vendor-official-json-editor"
              aria-label={t("settings.vendor.localProviderDescription")}
              value={loading ? t("settings.loading") : jsonConfig}
              onChange={(event) => {
                setJsonConfig(event.target.value);
                setJsonError("");
              }}
              onKeyDown={handleEditorKeyDown}
              rows={18}
              disabled={loading || saving}
              spellCheck={false}
            />
            {jsonError && <div className="vendor-json-error">{jsonError}</div>}
          </div>
        </div>

        <div className="vendor-dialog-footer">
          <button
            type="button"
            className="vendor-btn-cancel"
            onClick={onClose}
            disabled={saving}
          >
            {t("settings.vendor.cancel")}
          </button>
          <button
            type="button"
            className="vendor-btn-save"
            onClick={handleSave}
            disabled={loading || saving}
          >
            {t("settings.vendor.dialog.saveChanges")}
          </button>
        </div>
      </div>
    </div>
  );
}
