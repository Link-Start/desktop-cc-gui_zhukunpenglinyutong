import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useCcSwitchImport,
  type CcSwitchImportSummary,
  type CcSwitchImportTarget,
} from "../hooks/useCcSwitchImport";

interface CcSwitchImportDialogProps {
  isOpen: boolean;
  target: CcSwitchImportTarget;
  /** 现有供应商 id, 用于区分 新增/更新 */
  existingProviderIds: string[];
  /** 指定 cc-switch.db / config.json 文件路径; 缺省自动检测 ~/.cc-switch */
  sourcePath?: string | null;
  onClose: () => void;
  /** 导入完成后通知父组件刷新列表 */
  onImported: (summary: CcSwitchImportSummary) => void;
}

export function CcSwitchImportDialog({
  isOpen,
  target,
  existingProviderIds,
  sourcePath = null,
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
    toggleItem,
    toggleAll,
    importSelected,
    reload,
  } = useCcSwitchImport({ target, existingProviderIds, isOpen, sourcePath });

  const [summary, setSummary] = useState<CcSwitchImportSummary | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSummary(null);
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

  const newCount = items.filter((item) => item.status === "new").length;
  const updateCount = items.length - newCount;
  const allSelected = items.length > 0 && selectedIds.size >= items.length;
  const importedTotal = (summary?.addedCount ?? 0) + (summary?.updatedCount ?? 0);

  const handleImport = async () => {
    const result = await importSelected();
    setSummary(result);
    if (result.addedCount > 0 || result.updatedCount > 0) {
      onImported(result);
    }
  };

  return (
    <div className="vendor-dialog-overlay" onClick={onClose}>
      <div
        className="vendor-dialog vendor-cc-switch-import-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="vendor-dialog-header">
          <div className="vendor-cc-switch-import-heading">
            <h3>{t("settings.vendor.ccSwitchImport.title")}</h3>
          </div>
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
              className="vendor-dialog-close"
              onClick={onClose}
              aria-label={t("settings.vendor.ccSwitchImport.close")}
            >
              ×
            </button>
          </div>
        </div>

        <div className="vendor-dialog-body">
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
            <>
              <div className="vendor-cc-switch-import-summary">
                {t("settings.vendor.ccSwitchImport.summary", {
                  total: items.length,
                })}
                <span className="vendor-cc-switch-import-badge-new">
                  {t("settings.vendor.ccSwitchImport.newCount", {
                    count: newCount,
                  })}
                </span>
                ，
                <span className="vendor-cc-switch-import-badge-update">
                  {t("settings.vendor.ccSwitchImport.updateCount", {
                    count: updateCount,
                  })}
                </span>
              </div>

              <div className="vendor-cc-switch-import-table-header">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={() => toggleAll()}
                  aria-label={t("settings.vendor.ccSwitchImport.selectAll")}
                />
                <span>{t("settings.vendor.ccSwitchImport.columnName")}</span>
                <span>{t("settings.vendor.ccSwitchImport.columnId")}</span>
                <span>{t("settings.vendor.ccSwitchImport.columnStatus")}</span>
              </div>

              <div className="vendor-cc-switch-import-list">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`vendor-cc-switch-import-row${
                      selectedIds.has(item.id) ? " selected" : ""
                    }`}
                    onClick={() => toggleItem(item.id)}
                  >
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      disabled={importing}
                      onCheckedChange={() => toggleItem(item.id)}
                      onClick={(event) => event.stopPropagation()}
                      aria-label={item.name}
                    />
                    <span className="vendor-cc-switch-import-cell-name">
                      {item.name || item.id}
                    </span>
                    <span className="vendor-cc-switch-import-cell-id">
                      {item.id}
                    </span>
                    <span
                      className={`vendor-cc-switch-import-status-${
                        item.status === "new" ? "new" : "update"
                      }`}
                    >
                      {item.status === "new"
                        ? t("settings.vendor.ccSwitchImport.statusNew")
                        : t("settings.vendor.ccSwitchImport.statusUpdate")}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {summary ? (
            <div
              className={`vendor-cc-switch-import-banner${
                summary.failures.length > 0 ? " has-failures" : ""
              }`}
              role="status"
            >
              {t("settings.vendor.ccSwitchImport.successBanner", {
                count: importedTotal,
              })}
              {summary.failures.length > 0
                ? ` · ${t("settings.vendor.ccSwitchImport.failureBanner", {
                    count: summary.failures.length,
                    names: summary.failures.map((failure) => failure.name).join(", "),
                  })}`
                : ""}
            </div>
          ) : null}
        </div>

        <div className="vendor-dialog-footer">
          <span className="vendor-cc-switch-import-footer-count">
            {t("settings.vendor.ccSwitchImport.selectedCount", {
              count: selectedIds.size,
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
              : t("settings.vendor.ccSwitchImport.confirmImport")}
          </Button>
        </div>
      </div>
    </div>
  );
}
