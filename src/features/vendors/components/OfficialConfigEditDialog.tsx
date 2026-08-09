/**
 * Shared shell for official CLI config editors (Claude / Codex / Kimi / Grok / OpenCode).
 * Supports one or more panes with consistent title · path · actions · textarea chrome.
 */
import {
  useEffect,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import FolderOpen from "lucide-react/dist/esm/icons/folder-open";
import { Button } from "@/components/ui/button";
import { openFolderInFileManager } from "../../../services/tauri";

export type OfficialConfigEditorFormat = "toml" | "json" | "text";

export type OfficialConfigEditorPane = {
  id: string;
  title: string;
  pathLabel?: string;
  /**
   * Absolute or `~/…` path used to open the **containing folder** in the OS
   * file manager (not the file itself). Defaults to pathLabel when omitted.
   */
  openFolderPath?: string;
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  /** Extra attributes on the textarea (e.g. data-codex-editor) */
  dataAttributes?: Record<string, string>;
  /** When true, show reveal/hide sensitive control; caller supplies display value */
  sensitive?: boolean;
  sensitiveVisible?: boolean;
  onSensitiveVisibleChange?: (visible: boolean) => void;
  showFormatJson?: boolean;
  onFormatJson?: () => void;
  /** Show "open containing folder" when a resolvable path is available (default true if path present) */
  showOpenFolder?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  rows?: number;
  headerActions?: ReactNode;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
};

export type OfficialConfigEditDialogProps = {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  onSave: () => void | Promise<void>;
  panes: OfficialConfigEditorPane[];
  loading?: boolean;
  saving?: boolean;
  saveDisabled?: boolean;
  error?: ReactNode;
  /** Optional class on body for engine-specific tweaks */
  bodyClassName?: string;
};

function insertTwoSpaceTab(
  event: ReactKeyboardEvent<HTMLTextAreaElement>,
  onChange: (value: string) => void,
) {
  if (event.key !== "Tab") {
    return false;
  }
  event.preventDefault();
  const target = event.currentTarget;
  const { selectionStart, selectionEnd, value } = target;
  const nextValue = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`;
  onChange(nextValue);
  requestAnimationFrame(() => {
    const cursorPosition = selectionStart + 2;
    target.setSelectionRange(cursorPosition, cursorPosition);
  });
  return true;
}

export function OfficialConfigEditDialog({
  isOpen,
  title,
  onClose,
  onSave,
  panes,
  loading = false,
  saving = false,
  saveDisabled = false,
  error = null,
  bodyClassName,
}: OfficialConfigEditDialogProps) {
  const { t } = useTranslation();
  const [openingFolderId, setOpeningFolderId] = useState<string | null>(null);
  const [folderError, setFolderError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setOpeningFolderId(null);
      setFolderError("");
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

  const multiPane = panes.length > 1;
  const bodyClass = [
    "vendor-dialog-body",
    "vendor-official-config-dialog-body",
    multiPane ? "is-multi-pane" : "is-single-pane",
    bodyClassName,
  ]
    .filter(Boolean)
    .join(" ");

  const handleOpenFolder = async (pane: OfficialConfigEditorPane) => {
    const target = (pane.openFolderPath ?? pane.pathLabel)?.trim();
    if (!target) {
      return;
    }
    setOpeningFolderId(pane.id);
    setFolderError("");
    try {
      await openFolderInFileManager(target);
    } catch (error) {
      setFolderError(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setOpeningFolderId(null);
    }
  };

  return (
    <div className="vendor-dialog-overlay" role="dialog" aria-modal="true">
      <div className="vendor-dialog vendor-dialog-wide vendor-official-json-dialog">
        <div className="vendor-dialog-header">
          <h3>{title}</h3>
          <button
            type="button"
            className="vendor-dialog-close"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            ×
          </button>
        </div>

        <div className={bodyClass} data-pane-count={panes.length}>
          {panes.map((pane) => {
            const disabled = Boolean(pane.disabled || loading || saving);
            const displayValue = loading ? t("settings.loading") : pane.value;
            const folderTarget = (pane.openFolderPath ?? pane.pathLabel)?.trim();
            const showOpenFolder =
              Boolean(folderTarget) && pane.showOpenFolder !== false;
            const dataProps = Object.fromEntries(
              Object.entries(pane.dataAttributes ?? {}).map(([key, value]) => [
                key.startsWith("data-") ? key : `data-${key}`,
                value,
              ]),
            );

            return (
              <div
                key={pane.id}
                className="vendor-json-section vendor-official-config-pane"
              >
                <header className="vendor-official-config-pane-header">
                  <div className="vendor-official-config-pane-meta">
                    <span className="vendor-official-config-pane-title">
                      {pane.title}
                    </span>
                    {pane.pathLabel ? (
                      <code className="vendor-official-config-pane-path">
                        {pane.pathLabel}
                      </code>
                    ) : null}
                  </div>
                  {pane.headerActions ||
                  pane.showFormatJson ||
                  pane.sensitive ||
                  showOpenFolder ? (
                    <div className="vendor-official-config-pane-actions">
                      {pane.headerActions}
                      {showOpenFolder ? (
                        <button
                          type="button"
                          className="vendor-official-config-pane-action-btn vendor-official-config-pane-open-folder"
                          onClick={() => {
                            void handleOpenFolder(pane);
                          }}
                          disabled={
                            disabled || openingFolderId === pane.id
                          }
                          title={t(
                            "settings.vendor.dialog.openContainingFolder",
                            {
                              defaultValue: "Open file",
                            },
                          )}
                          aria-label={t(
                            "settings.vendor.dialog.openContainingFolder",
                            {
                              defaultValue: "Open file",
                            },
                          )}
                        >
                          <FolderOpen size={13} aria-hidden />
                          <span>
                            {t("settings.vendor.dialog.openContainingFolder", {
                              defaultValue: "Open file",
                            })}
                          </span>
                        </button>
                      ) : null}
                      {pane.showFormatJson ? (
                        <button
                          type="button"
                          className="vendor-official-config-pane-action-btn"
                          onClick={pane.onFormatJson}
                          disabled={disabled || !pane.onFormatJson}
                        >
                          {t("settings.vendor.dialog.formatJson")}
                        </button>
                      ) : null}
                      {pane.sensitive ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() =>
                            pane.onSensitiveVisibleChange?.(
                              !pane.sensitiveVisible,
                            )
                          }
                          disabled={loading || saving}
                        >
                          {pane.sensitiveVisible
                            ? t("settings.vendor.codexAuthConfigHideSensitive")
                            : t("settings.vendor.codexAuthConfigShowSensitive")}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </header>
                <textarea
                  className="vendor-json-editor vendor-official-json-editor"
                  aria-label={pane.ariaLabel ?? pane.title}
                  value={displayValue}
                  onChange={(event) => {
                    if (pane.readOnly) {
                      return;
                    }
                    pane.onChange(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (pane.onKeyDown) {
                      pane.onKeyDown(event);
                      return;
                    }
                    if (pane.readOnly || disabled) {
                      return;
                    }
                    insertTwoSpaceTab(event, pane.onChange);
                  }}
                  rows={pane.rows ?? (multiPane ? 10 : 18)}
                  readOnly={pane.readOnly}
                  disabled={disabled}
                  spellCheck={false}
                  {...dataProps}
                />
              </div>
            );
          })}

          {error ? <div className="vendor-json-error">{error}</div> : null}
          {folderError ? (
            <div className="vendor-json-error">{folderError}</div>
          ) : null}
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
            onClick={() => {
              void onSave();
            }}
            disabled={loading || saving || saveDisabled}
          >
            {t("settings.vendor.dialog.saveChanges")}
          </button>
        </div>
      </div>
    </div>
  );
}
