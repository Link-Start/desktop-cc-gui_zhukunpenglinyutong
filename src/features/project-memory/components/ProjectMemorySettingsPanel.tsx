import ShieldCheck from "lucide-react/dist/esm/icons/shield-check";
import Wrench from "lucide-react/dist/esm/icons/wrench";
import { useTranslation } from "react-i18next";
import type {
  ProjectMemoryDiagnosticsResult,
  ProjectMemoryReconcileResult,
} from "../../../services/tauri";

type ProjectMemorySettingsPanelProps = {
  showSettings: boolean;
  workspaceId: string | null;
  workspaceAutoEnabled: boolean;
  settingsLoading: boolean;
  manualInjectionMode: "summary" | "detail";
  pollutionBusy: "scan" | "cleanup" | null;
  pollutionCandidateCount: number;
  pollutionScannedTotal: number;
  pollutionMessage: string | null;
  diagnosticsBusy: "diagnostics" | "dry-run" | "apply" | null;
  diagnostics: ProjectMemoryDiagnosticsResult | null;
  reconcileResult: ProjectMemoryReconcileResult | null;
  total: number;
  onToggleWorkspaceAutoCapture: () => void;
  onManualInjectionModeChange: (mode: "summary" | "detail") => void;
  onScanPolluted: () => void;
  onCleanupPolluted: () => void;
  onClearAll: () => void;
  onRunDiagnostics: () => void;
  onRunReconcileDryRun: () => void;
  onApplyReconcile: () => void;
};

export function ProjectMemorySettingsPanel({
  showSettings,
  workspaceId,
  workspaceAutoEnabled,
  settingsLoading,
  manualInjectionMode,
  pollutionBusy,
  pollutionCandidateCount,
  pollutionScannedTotal,
  pollutionMessage,
  diagnosticsBusy,
  diagnostics,
  reconcileResult,
  total,
  onToggleWorkspaceAutoCapture,
  onManualInjectionModeChange,
  onScanPolluted,
  onCleanupPolluted,
  onClearAll,
  onRunDiagnostics,
  onRunReconcileDryRun,
  onApplyReconcile,
}: ProjectMemorySettingsPanelProps) {
  const { t } = useTranslation();
  return (
    <div className={`project-memory-settings${showSettings ? " is-open" : ""}`}>
      <div className="project-memory-toggle-row">
        <label className="project-memory-toggle">
          <input
            type="checkbox"
            checked={workspaceAutoEnabled}
            disabled={!workspaceId || settingsLoading}
            onChange={() => {
              onToggleWorkspaceAutoCapture();
            }}
          />
          <span>{t("memory.autoCaptureWorkspace")}</span>
        </label>
        <label className="project-memory-toggle project-memory-toggle-disabled">
          <input type="checkbox" checked={false} disabled readOnly />
          <span>{t("memory.contextInjectionEnabled")}</span>
        </label>
      </div>
      <div className="project-memory-toggle-hint">{t("memory.contextInjectionManualHint")}</div>
      <div className="project-memory-injection-mode-row">
        <span className="project-memory-injection-mode-label">{t("memory.manualInjectionMode")}</span>
        <select
          className="project-memory-kind-select project-memory-injection-mode-select"
          value={manualInjectionMode}
          onChange={(event) => {
            onManualInjectionModeChange(event.target.value === "summary" ? "summary" : "detail");
          }}
        >
          <option value="detail">{t("memory.manualInjectionModeDetail")}</option>
          <option value="summary">{t("memory.manualInjectionModeSummary")}</option>
        </select>
      </div>
      <div className="project-memory-toggle-hint">{t("memory.manualInjectionModeHint")}</div>
      <div className="project-memory-cleanup">
        <div className="project-memory-cleanup-header">
          <div className="project-memory-cleanup-title">{t("memory.cleanupTitle")}</div>
          <div className="project-memory-cleanup-actions">
            <button
              type="button"
              className="project-memory-action-btn compact"
              onClick={onScanPolluted}
              disabled={!workspaceId || pollutionBusy !== null}
            >
              {pollutionBusy === "scan" ? t("memory.cleanupScanning") : t("memory.cleanupScan")}
            </button>
            <button
              type="button"
              className="project-memory-action-btn compact danger"
              onClick={onCleanupPolluted}
              disabled={!workspaceId || pollutionBusy !== null || pollutionCandidateCount === 0}
            >
              {pollutionBusy === "cleanup" ? t("memory.cleanupRunning") : t("memory.cleanupRun")}
            </button>
            <button
              type="button"
              className="project-memory-action-btn compact danger"
              onClick={onClearAll}
              disabled={!workspaceId || total === 0}
            >
              {t("memory.clearAll")}
            </button>
          </div>
        </div>
        <div className="project-memory-cleanup-hint">
          {pollutionMessage
            ? pollutionMessage
            : pollutionScannedTotal > 0
              ? t("memory.cleanupScanned", { total: pollutionScannedTotal })
              : t("memory.cleanupHint")}
        </div>
      </div>
      <div className="project-memory-cleanup project-memory-diagnostics">
        <div className="project-memory-cleanup-header">
          <div className="project-memory-cleanup-title">{t("memory.diagnosticsTitle")}</div>
          <div className="project-memory-cleanup-actions">
            <button
              type="button"
              className="project-memory-action-btn compact"
              onClick={onRunDiagnostics}
              disabled={!workspaceId || diagnosticsBusy !== null}
            >
              <ShieldCheck size={13} aria-hidden />
              <span>
                {diagnosticsBusy === "diagnostics"
                  ? t("memory.diagnosticsRunning")
                  : t("memory.diagnosticsRun")}
              </span>
            </button>
            <button
              type="button"
              className="project-memory-action-btn compact"
              onClick={onRunReconcileDryRun}
              disabled={!workspaceId || diagnosticsBusy !== null}
            >
              {diagnosticsBusy === "dry-run"
                ? t("memory.reconcileRunning")
                : t("memory.reconcileDryRun")}
            </button>
            <button
              type="button"
              className="project-memory-action-btn compact danger"
              onClick={onApplyReconcile}
              disabled={
                !workspaceId ||
                diagnosticsBusy !== null ||
                !reconcileResult ||
                reconcileResult.fixableCount === 0
              }
            >
              <Wrench size={13} aria-hidden />
              <span>
                {diagnosticsBusy === "apply"
                  ? t("memory.reconcileRunning")
                  : t("memory.reconcileApply")}
              </span>
            </button>
          </div>
        </div>
        <div className="project-memory-cleanup-hint">
          {diagnostics
            ? t("memory.diagnosticsSummary", {
                total: diagnostics.total,
                incomplete:
                  diagnostics.healthCounts.input_only +
                  diagnostics.healthCounts.assistant_only +
                  diagnostics.healthCounts.pending_fusion +
                  diagnostics.healthCounts.capture_failed,
                duplicates: diagnostics.duplicateTurnGroups.length,
                badFiles: diagnostics.badFiles.length,
              })
            : t("memory.diagnosticsHint")}
        </div>
        {reconcileResult ? (
          <div className="project-memory-cleanup-hint">
            {t("memory.reconcileSummary", {
              fixable: reconcileResult.fixableCount,
              fixed: reconcileResult.fixedCount,
              skipped: reconcileResult.skippedCount,
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
