import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useCcSwitchImport,
  type CcSwitchImportSummary,
  type CcSwitchImportTarget,
  type ExistingProviderKey,
} from "../hooks/useCcSwitchImport";

interface CcSwitchImportDialogProps {
  isOpen: boolean;
  target: CcSwitchImportTarget;
  existingProviders: ExistingProviderKey[];
  onClose: () => void;
  /** 导入完成后通知父组件刷新列表 */
  onImported: (summary: CcSwitchImportSummary) => void;
}

export function CcSwitchImportDialog({
  isOpen,
  target,
  existingProviders,
  onClose,
  onImported,
}: CcSwitchImportDialogProps) {
  const { t } = useTranslation();
  const {
    items,
    available,
    loading,
    importing,
    selectedIds,
    selectableCount,
    toggleItem,
    toggleAll,
    importSelected,
    reload,
  } = useCcSwitchImport({ target, existingProviders, isOpen });

  const [summary, setSummary] = useState<CcSwitchImportSummary | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSummary(null);
      return;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const categoryLabel =
    target === "codex"
      ? t("settings.vendor.ccSwitchImport.categoryOpenAI")
      : t("settings.vendor.ccSwitchImport.categoryAnthropic");

  const handleImport = async () => {
    const result = await importSelected();
    setSummary(result);
    if (result.importedCount > 0) {
      onImported(result);
    }
  };

  const allSelected = selectableCount > 0 && selectedIds.size >= selectableCount;

  return (
    <div className="vendor-dialog-overlay" onClick={onClose}>
      <div
        className="vendor-dialog vendor-cc-switch-import-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="vendor-dialog-header">
          <div className="vendor-cc-switch-import-heading">
            <h3>{t("settings.vendor.ccSwitchImport.title")}</h3>
            <p className="vendor-dialog-description">
              {t("settings.vendor.ccSwitchImport.subtitle")}
            </p>
          </div>
          <button
            type="button"
            className="vendor-dialog-close"
            onClick={onClose}
            aria-label={t("settings.vendor.ccSwitchImport.close")}
          >
            ×
          </button>
        </div>

        <div className="vendor-cc-switch-import-body">
          <aside className="vendor-cc-switch-import-categories">
            <div className="vendor-cc-switch-import-category active">
              <span className="vendor-cc-switch-import-category-name">
                {categoryLabel}
              </span>
              <span className="vendor-cc-switch-import-category-count">
                {t("settings.vendor.ccSwitchImport.configCount", {
                  count: items.length,
                })}
              </span>
            </div>
          </aside>

          <section className="vendor-cc-switch-import-list-pane">
            <div className="vendor-cc-switch-import-toolbar">
              <span>
                {t("settings.vendor.ccSwitchImport.selectedCount", {
                  selected: selectedIds.size,
                  total: selectableCount,
                })}
              </span>
              <div className="vendor-cc-switch-import-toolbar-actions">
                <button
                  type="button"
                  className="vendor-cc-switch-import-tool-btn"
                  onClick={reload}
                  disabled={loading}
                  aria-label={t("settings.vendor.ccSwitchImport.refresh")}
                >
                  <RefreshCw size={12} />
                </button>
                <button
                  type="button"
                  className="vendor-cc-switch-import-tool-btn"
                  onClick={toggleAll}
                  disabled={selectableCount === 0}
                >
                  {allSelected
                    ? t("settings.vendor.ccSwitchImport.deselectAll")
                    : t("settings.vendor.ccSwitchImport.selectAll")}
                </button>
              </div>
            </div>

            <div className="vendor-cc-switch-import-list">
              {loading ? (
                <div className="vendor-cc-switch-import-empty">
                  {t("settings.vendor.ccSwitchImport.loading")}
                </div>
              ) : !available ? (
                <div className="vendor-cc-switch-import-empty">
                  {t("settings.vendor.ccSwitchImport.emptySource")}
                </div>
              ) : items.length === 0 ? (
                <div className="vendor-cc-switch-import-empty">
                  {t("settings.vendor.ccSwitchImport.emptyCategory")}
                </div>
              ) : (
                items.map((item) => (
                  <label
                    key={item.id}
                    className={`vendor-cc-switch-import-row${
                      item.imported ? " imported" : ""
                    }`}
                  >
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      disabled={item.imported || importing}
                      onCheckedChange={() => toggleItem(item.id)}
                      aria-label={item.name}
                    />
                    <span className="vendor-cc-switch-import-row-main">
                      <span className="vendor-cc-switch-import-row-title">
                        {item.name}
                        {item.imported ? (
                          <span className="vendor-cc-switch-import-badge-imported">
                            {t("settings.vendor.ccSwitchImport.importedBadge")}
                          </span>
                        ) : null}
                        {!item.imported && !item.hasApiKey ? (
                          <span className="vendor-cc-switch-import-badge-no-key">
                            {t("settings.vendor.ccSwitchImport.noApiKey")}
                          </span>
                        ) : null}
                      </span>
                      <span className="vendor-cc-switch-import-row-subtitle">
                        {item.baseUrl ??
                          t("settings.vendor.ccSwitchImport.noBaseUrl")}
                      </span>
                    </span>
                  </label>
                ))
              )}
            </div>

            {summary ? (
              <div
                className={`vendor-cc-switch-import-banner${
                  summary.failures.length > 0 ? " has-failures" : ""
                }`}
                role="status"
              >
                {t("settings.vendor.ccSwitchImport.successBanner", {
                  count: summary.importedCount,
                })}
                {summary.failures.length > 0
                  ? ` · ${t("settings.vendor.ccSwitchImport.failureBanner", {
                      count: summary.failures.length,
                      names: summary.failures.map((failure) => failure.name).join(", "),
                    })}`
                  : ""}
              </div>
            ) : null}
          </section>
        </div>

        <div className="vendor-dialog-footer">
          <span className="vendor-cc-switch-import-footer-count">
            {t("settings.vendor.ccSwitchImport.selectedCount", {
              selected: selectedIds.size,
              total: selectableCount,
            })}
          </span>
          <button
            type="button"
            className="vendor-btn-cancel"
            onClick={onClose}
          >
            {summary
              ? t("settings.vendor.ccSwitchImport.close")
              : t("settings.vendor.ccSwitchImport.cancel")}
          </button>
          <Button
            size="sm"
            disabled={selectedIds.size === 0 || importing}
            onClick={() => void handleImport()}
          >
            {importing
              ? t("settings.vendor.ccSwitchImport.importing")
              : t("settings.vendor.ccSwitchImport.importButton", {
                  count: selectedIds.size,
                })}
          </Button>
        </div>
      </div>
    </div>
  );
}
