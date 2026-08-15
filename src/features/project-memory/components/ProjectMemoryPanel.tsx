import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import Settings2 from "lucide-react/dist/esm/icons/settings-2";
import X from "lucide-react/dist/esm/icons/x";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import HelpCircle from "lucide-react/dist/esm/icons/help-circle";
import CheckSquare from "lucide-react/dist/esm/icons/check-square";
import Square from "lucide-react/dist/esm/icons/square";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import Copy from "lucide-react/dist/esm/icons/copy";
import type { PanelTabId } from "../../layout/components/PanelTabs";
import { useProjectMemory } from "../hooks/useProjectMemory";
import type {
  ProjectMemoryDiagnosticsResult,
  ProjectMemoryReconcileResult,
} from "../../../services/tauri";
import type { WorkspaceInfo } from "../../../types";
import {
  deriveProjectMemoryHealthState,
  deriveProjectMemoryReviewState,
  getProjectMemoryDisplayRecordKind,
  isConversationTurnMemory,
  resolveProjectMemoryDetailText,
  resolveProjectMemorySourceLocator,
  type ProjectMemoryHealthState,
  type ProjectMemoryReviewState,
} from "../utils/projectMemoryDisplay";
import {
  getManualMemoryInjectionMode,
  setManualMemoryInjectionMode,
} from "../utils/manualInjectionMode";
import { ProjectMemoryConfirmDialog } from "./ProjectMemoryConfirmDialog";
import { ProjectMemoryDetail } from "./ProjectMemoryDetail";
import { ProjectMemoryList } from "./ProjectMemoryList";
import { ProjectMemorySettingsPanel } from "./ProjectMemorySettingsPanel";
import { ProjectMemoryToolbar } from "./ProjectMemoryToolbar";
import {
  DEFAULT_VISIBLE_QUICK_TAG_COUNT,
  parseMemoryDetailSections,
  parseTagTerms,
} from "./projectMemoryPanelHelpers";
import { createProjectMemoryPanelLabels } from "./projectMemoryPanelLabels";
import { useProjectMemoryPanelActions } from "./useProjectMemoryPanelActions";
import "../../../styles/project-memory.css";

type ProjectMemoryPanelProps = {
  workspaceId: string | null;
  workspaces?: readonly Pick<WorkspaceInfo, "id" | "name" | "path" | "connected">[];
  onSelectWorkspace?: (workspaceId: string) => void;
  filePanelMode: PanelTabId;
  onFilePanelModeChange: (mode: PanelTabId) => void;
  focusMemoryId?: string | null;
  focusRequestKey?: number;
};

export function ProjectMemoryPanel({
  workspaceId,
  workspaces = [],
  onSelectWorkspace,
  filePanelMode: _filePanelMode,
  onFilePanelModeChange,
  focusMemoryId = null,
  focusRequestKey = 0,
}: ProjectMemoryPanelProps) {
  const { t, i18n } = useTranslation();
  const labels = useMemo(() => createProjectMemoryPanelLabels(t), [t]);
  const {
    items,
    loading,
    error,
    query,
    kind,
    importance,
    tag,
    total,
    page,
    pageSize,
    selectedId,
    selectedItem,
    detailLoading,
    detailError,
    workspaceAutoEnabled,
    settingsLoading,
    setQuery,
    setKind,
    setImportance,
    setTag,
    setPage,
    setSelectedId,
    toggleWorkspaceAutoCapture,
    refresh,
    updateMemory,
    deleteMemory,
  } = useProjectMemory({
    workspaceId,
    preferredSelectedId: focusMemoryId,
    preferredSelectionKey: focusRequestKey,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [managerOpen, setManagerOpen] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [batchUpdating, setBatchUpdating] = useState(false);
  const [detailTextDraft, setDetailTextDraft] = useState("");
  const [detailSaving, setDetailSaving] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [showAllQuickTags, setShowAllQuickTags] = useState(false);
  const [pollutionCandidateIds, setPollutionCandidateIds] = useState<string[]>([]);
  const [pollutionScannedTotal, setPollutionScannedTotal] = useState(0);
  const [pollutionBusy, setPollutionBusy] = useState<"scan" | "cleanup" | null>(null);
  const [pollutionMessage, setPollutionMessage] = useState<string | null>(null);
  const [reviewFilter, setReviewFilter] = useState<ProjectMemoryReviewState | "all">("all");
  const [healthFilter, setHealthFilter] = useState<ProjectMemoryHealthState | "all">("all");
  const [diagnostics, setDiagnostics] = useState<ProjectMemoryDiagnosticsResult | null>(null);
  const [diagnosticsBusy, setDiagnosticsBusy] = useState<"diagnostics" | "dry-run" | "apply" | null>(null);
  const [reconcileResult, setReconcileResult] = useState<ProjectMemoryReconcileResult | null>(null);
  const [showReconcileApplyConfirm, setShowReconcileApplyConfirm] = useState(false);
  const [manualInjectionMode, setManualInjectionModeState] = useState<"summary" | "detail">(
    () => getManualMemoryInjectionMode(),
  );
  const workspaceSelectValue = workspaceId ?? "";
  const hasWorkspacePicker = workspaces.length > 0;

  const emptyMessage = useMemo(() => {
    if (!workspaceId) {
      return t("memory.selectWorkspace");
    }
    if (loading) {
      return t("memory.loading");
    }
    if (items.length === 0) {
      return t("memory.empty");
    }
    return null;
  }, [items.length, loading, t, workspaceId]);
  const detailSections = useMemo(
    () => parseMemoryDetailSections(detailTextDraft),
    [detailTextDraft],
  );
  const selectedRecordKind = useMemo(
    () => (selectedItem ? getProjectMemoryDisplayRecordKind(selectedItem) : null),
    [selectedItem],
  );
  const selectedIsConversationTurn = Boolean(
    selectedItem && isConversationTurnMemory(selectedItem),
  );
  const selectedDetailText = useMemo(() => {
    if (!selectedItem) {
      return "";
    }
    return resolveProjectMemoryDetailText(selectedItem, {
      userInput: t("memory.turnUserInput"),
      assistantResponse: t("memory.turnAssistantResponse"),
      assistantThinkingSummary: t("memory.turnAssistantThinkingSummary"),
    });
  }, [selectedItem, t]);
  const activeTagTerms = useMemo(() => parseTagTerms(tag), [tag]);
  const availableTags = useMemo(() => {
    const bag = new Set<string>();
    items.forEach((item) => {
      item.tags.forEach((entry) => {
        const normalized = entry.trim();
        if (normalized) {
          bag.add(normalized);
        }
      });
    });
    return Array.from(bag).sort((a, b) => a.localeCompare(b)).slice(0, 24);
  }, [items]);
  const visibleQuickTags = useMemo(
    () =>
      showAllQuickTags ? availableTags : availableTags.slice(0, DEFAULT_VISIBLE_QUICK_TAG_COUNT),
    [availableTags, showAllQuickTags],
  );
  const hiddenQuickTagCount = Math.max(0, availableTags.length - visibleQuickTags.length);
  const reviewInboxCount = useMemo(
    () => items.filter((item) => deriveProjectMemoryReviewState(item) === "unreviewed").length,
    [items],
  );
  const healthIssueCount = useMemo(
    () => items.filter((item) => deriveProjectMemoryHealthState(item) !== "complete").length,
    [items],
  );
  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const reviewState = deriveProjectMemoryReviewState(item);
        const healthState = deriveProjectMemoryHealthState(item);
        return (
          (reviewFilter === "all" || reviewState === reviewFilter) &&
          (healthFilter === "all" || healthState === healthFilter)
        );
      }),
    [healthFilter, items, reviewFilter],
  );
  const selectedSourceLocator = useMemo(
    () => (selectedItem ? resolveProjectMemorySourceLocator(selectedItem) : null),
    [selectedItem],
  );

  useEffect(() => {
    if (!selectedItem) {
      setDetailTextDraft("");
      return;
    }
    setDetailTextDraft(selectedDetailText);
  }, [selectedDetailText, selectedItem]);

  useEffect(() => {
    if (!workspaceId || !focusMemoryId) {
      return;
    }
    setManagerOpen(true);
    setSelectedIds(new Set());
    setQuery("");
    setKind(null);
    setImportance(null);
    setTag("");
    setPage(0);
  }, [
    focusMemoryId,
    focusRequestKey,
    setImportance,
    setKind,
    setPage,
    setQuery,
    setTag,
    workspaceId,
  ]);

  const formatMemoryDateTime = (value?: number) => {
    if (!value || !Number.isFinite(value)) {
      return "--";
    }
    return new Intl.DateTimeFormat(i18n.language || undefined, {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  };

  const closeManager = useCallback(() => {
    setManagerOpen(false);
    onFilePanelModeChange("git");
  }, [onFilePanelModeChange]);

  useEffect(() => {
    if (!managerOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeManager();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeManager, managerOpen]);

  const {
    handleScanPollutedMemories,
    handleCleanupPollutedMemories,
    handleDelete,
    handleSaveManualDetail,
    handleCopySelectedTurn,
    handleCopySourceLocator,
    handleSetReviewState,
    handleConvertToManualNote,
    handleRunDiagnostics,
    handleRunReconcileDryRun,
    handleApplyReconcile,
    confirmDelete,
    toggleSelectAll,
    toggleQuickTag,
    toggleSelectItem,
    handleBatchSetImportance,
    handleBatchDelete,
    handleClearAll,
  } = useProjectMemoryPanelActions({
    workspaceId,
    items,
    selectedItem,
    selectedIsConversationTurn,
    selectedSourceLocator,
    selectedIds,
    pollutionCandidateIds,
    detailTextDraft,
    tag,
    total,
    t,
    labels,
    refresh,
    updateMemory,
    deleteMemory,
    setPollutionBusy,
    setPollutionMessage,
    setPollutionScannedTotal,
    setPollutionCandidateIds,
    setDeleteError,
    setShowDeleteConfirm,
    setDetailSaving,
    setCopyMessage,
    setDiagnosticsBusy,
    setDiagnostics,
    setReconcileResult,
    setShowReconcileApplyConfirm,
    setSelectedIds,
    setShowBatchDeleteConfirm,
    setShowClearAllConfirm,
    setBatchUpdating,
    setTag,
  });


  const renderManagerBody = (isModal: boolean) => (
    <div className={`project-memory-body${isModal ? " is-modal" : ""}`}>
      <div className="project-memory-workbench-strip" aria-label={t("memory.workbenchOverview")}>
        <div className="project-memory-workbench-stat">
          <span>{t("memory.workbenchTotal")}</span>
          <strong>{total}</strong>
        </div>
        <div className="project-memory-workbench-stat">
          <span>{t("memory.workbenchSelected")}</span>
          <strong>{selectedIds.size}</strong>
        </div>
        <div className="project-memory-workbench-stat">
          <span>{t("memory.workbenchReview")}</span>
          <strong>{reviewInboxCount}</strong>
        </div>
        <div className="project-memory-workbench-stat">
          <span>{t("memory.workbenchHealth")}</span>
          <strong>{healthIssueCount}</strong>
        </div>
      </div>

      <ProjectMemoryToolbar
        query={query}
        kind={kind}
        importance={importance}
        reviewFilter={reviewFilter}
        healthFilter={healthFilter}
        tag={tag}
        availableTags={availableTags}
        visibleQuickTags={visibleQuickTags}
        activeTagTerms={activeTagTerms}
        showAllQuickTags={showAllQuickTags}
        hiddenQuickTagCount={hiddenQuickTagCount}
        onQueryChange={setQuery}
        onKindChange={setKind}
        onImportanceChange={setImportance}
        onReviewFilterChange={setReviewFilter}
        onHealthFilterChange={setHealthFilter}
        onTagChange={setTag}
        onToggleQuickTag={toggleQuickTag}
        onToggleShowAllQuickTags={() => setShowAllQuickTags((value) => !value)}
      />

      <ProjectMemorySettingsPanel
        showSettings={showSettings}
        workspaceId={workspaceId}
        workspaceAutoEnabled={workspaceAutoEnabled}
        settingsLoading={settingsLoading}
        manualInjectionMode={manualInjectionMode}
        pollutionBusy={pollutionBusy}
        pollutionCandidateCount={pollutionCandidateIds.length}
        pollutionScannedTotal={pollutionScannedTotal}
        pollutionMessage={pollutionMessage}
        diagnosticsBusy={diagnosticsBusy}
        diagnostics={diagnostics}
        reconcileResult={reconcileResult}
        total={total}
        onToggleWorkspaceAutoCapture={() => {
          void toggleWorkspaceAutoCapture();
        }}
        onManualInjectionModeChange={(nextMode) => {
          setManualInjectionModeState(nextMode);
          setManualMemoryInjectionMode(nextMode);
        }}
        onScanPolluted={() => {
          void handleScanPollutedMemories();
        }}
        onCleanupPolluted={() => {
          void handleCleanupPollutedMemories();
        }}
        onClearAll={() => setShowClearAllConfirm(true)}
        onRunDiagnostics={() => {
          void handleRunDiagnostics();
        }}
        onRunReconcileDryRun={() => {
          void handleRunReconcileDryRun();
        }}
        onApplyReconcile={() => setShowReconcileApplyConfirm(true)}
      />

      <div className="project-memory-content">
        <ProjectMemoryList
          emptyMessage={emptyMessage}
          filteredItems={filteredItems}
          selectedId={selectedId}
          selectedIds={selectedIds}
          page={page}
          pageSize={pageSize}
          total={total}
          labels={labels}
          formatMemoryDateTime={formatMemoryDateTime}
          onToggleSelectItem={toggleSelectItem}
          onSelectItem={setSelectedId}
        />
        <ProjectMemoryDetail
          selectedItem={selectedItem}
          selectedRecordKind={selectedRecordKind}
          selectedIsConversationTurn={selectedIsConversationTurn}
          selectedSourceLocator={selectedSourceLocator}
          detailLoading={detailLoading}
          detailError={detailError}
          detailTextDraft={detailTextDraft}
          detailSections={detailSections}
          copyMessage={copyMessage}
          detailSaving={detailSaving}
          labels={labels}
          formatMemoryDateTime={formatMemoryDateTime}
          onCopySourceLocator={() => {
            void handleCopySourceLocator();
          }}
          onDetailTextChange={setDetailTextDraft}
          onSetReviewState={(nextState) => {
            void handleSetReviewState(nextState);
          }}
          onConvertToManualNote={() => {
            void handleConvertToManualNote();
          }}
        />
      </div>

      {items.length > 0 && (
        <div className="project-memory-actions">
          <div className="project-memory-batch-actions">
            <button
              type="button"
              className="project-memory-action-btn compact"
              onClick={toggleSelectAll}
              aria-label={
                selectedIds.size === items.length ? t("memory.unselectAll") : t("memory.selectAll")
              }
            >
              {selectedIds.size === items.length ? (
                <>
                  <Square size={14} aria-hidden />
                  <span>{t("memory.unselectAll")}</span>
                </>
              ) : (
                <>
                  <CheckSquare size={14} aria-hidden />
                  <span>{t("memory.selectAll")}</span>
                </>
              )}
            </button>
            {selectedIds.size > 0 && (
              <>
                <button
                  type="button"
                  className="project-memory-action-btn compact"
                  onClick={() => {
                    void handleBatchSetImportance("high");
                  }}
                  disabled={batchUpdating}
                >
                  {t("memory.batchSetHigh")}
                </button>
                <button
                  type="button"
                  className="project-memory-action-btn compact"
                  onClick={() => {
                    void handleBatchSetImportance("medium");
                  }}
                  disabled={batchUpdating}
                >
                  {t("memory.batchSetMedium")}
                </button>
                <button
                  type="button"
                  className="project-memory-action-btn compact"
                  onClick={() => {
                    void handleBatchSetImportance("low");
                  }}
                  disabled={batchUpdating}
                >
                  {t("memory.batchSetLow")}
                </button>
                <button
                  type="button"
                  className="project-memory-action-btn compact danger"
                  onClick={() => setShowBatchDeleteConfirm(true)}
                  disabled={batchUpdating}
                  aria-label={t("memory.batchDelete")}
                >
                  <Trash2 size={14} aria-hidden />
                  <span>
                    {t("memory.batchDelete")} ({selectedIds.size})
                  </span>
                </button>
              </>
            )}
          </div>

          <div className="project-memory-actions-divider" />

          <div className="project-memory-main-actions">
            {selectedIsConversationTurn ? (
              <button
                type="button"
                className="project-memory-action-btn"
                onClick={() => {
                  void handleCopySelectedTurn();
                }}
                disabled={!selectedItem}
                aria-label={t("memory.copyTurn")}
              >
                <Copy size={14} aria-hidden />
                <span>{t("memory.copyTurn")}</span>
              </button>
            ) : (
              <button
                type="button"
                className="project-memory-action-btn"
                onClick={() => {
                  void handleSaveManualDetail();
                }}
                disabled={!selectedItem || detailSaving}
                aria-label={t("memory.save")}
              >
                <span>{detailSaving ? t("memory.saving") : t("memory.save")}</span>
              </button>
            )}
            <button
              type="button"
              className="project-memory-action-btn danger"
              onClick={() => {
                void handleDelete();
              }}
              disabled={!selectedItem}
              aria-label={t("memory.delete")}
            >
              <Trash2 size={14} aria-hidden />
              <span>{t("memory.delete")}</span>
            </button>
          </div>
        </div>
      )}

      <div className={`project-memory-help${showHelp ? " is-visible" : ""}`}>
        <button
          type="button"
          className="project-memory-help-close"
          onClick={() => setShowHelp(false)}
          aria-label={t("memory.closeHelp")}
        >
          <X size={14} aria-hidden />
        </button>
        <h4 className="project-memory-help-title">{t("memory.helpTitle")}</h4>
        <ul className="project-memory-help-list">
          <li>{t("memory.helpAutoCapture")}</li>
          <li>{t("memory.helpContextInjection")}</li>
          <li>{t("memory.helpBatchOps")}</li>
          <li>{t("memory.helpMemoryTypes")}</li>
          <li>{t("memory.helpButtons")}</li>
          <li>{t("memory.helpFilters")}</li>
        </ul>
      </div>

      <div className="project-memory-pagination">
        <button
          type="button"
          className="project-memory-action-btn compact"
          onClick={() => setPage((current) => Math.max(0, current - 1))}
          disabled={page === 0 || loading}
          aria-label={t("memory.prevPage")}
        >
          <ChevronLeft size={16} aria-hidden />
        </button>
        <span className="project-memory-page-indicator">
          {page + 1} / {Math.max(1, Math.ceil(total / pageSize))}
        </span>
        <button
          type="button"
          className="project-memory-action-btn compact"
          onClick={() => setPage((current) => current + 1)}
          disabled={(page + 1) * pageSize >= total || loading}
          aria-label={t("memory.nextPage")}
        >
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>

      {(error || deleteError) && (
        <div className="project-memory-error">{error ?? deleteError}</div>
      )}

      {showBatchDeleteConfirm ? (
        <ProjectMemoryConfirmDialog
          title={t("memory.batchDelete")}
          message={t("memory.batchDeleteConfirm", { count: selectedIds.size })}
          onCancel={() => setShowBatchDeleteConfirm(false)}
          onConfirm={() => {
            void handleBatchDelete();
          }}
        />
      ) : null}
      {showClearAllConfirm ? (
        <ProjectMemoryConfirmDialog
          title={t("memory.clearAll")}
          message={t("memory.clearAllConfirm")}
          onCancel={() => setShowClearAllConfirm(false)}
          onConfirm={() => {
            void handleClearAll();
          }}
        />
      ) : null}
      {showDeleteConfirm ? (
        <ProjectMemoryConfirmDialog
          title={t("memory.delete")}
          message={t("memory.deleteConfirm")}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={() => {
            void confirmDelete();
          }}
        />
      ) : null}
      {showReconcileApplyConfirm ? (
        <ProjectMemoryConfirmDialog
          title={t("memory.reconcileApply")}
          message={t("memory.reconcileApplyConfirm")}
          confirmLabel={t("memory.reconcileApply")}
          onCancel={() => setShowReconcileApplyConfirm(false)}
          onConfirm={() => {
            void handleApplyReconcile();
          }}
        />
      ) : null}
    </div>
  );

  return (
    <>
      <section className="project-memory-panel" />
      {managerOpen && (
        <div className="project-memory-modal" role="dialog" aria-modal="true">
          <div className="project-memory-modal-backdrop" onClick={closeManager} />
          <div className="project-memory-modal-card">
            <div className="project-memory-modal-header">
              <h2 className="project-memory-modal-title">{t("memory.title")}</h2>
              <label className="project-memory-workspace-picker">
                <span>{t("memory.workspacePickerLabel")}</span>
                <select
                  value={workspaceSelectValue}
                  onChange={(event) => {
                    const nextWorkspaceId = event.target.value;
                    if (nextWorkspaceId && nextWorkspaceId !== workspaceId) {
                      onSelectWorkspace?.(nextWorkspaceId);
                    }
                  }}
                  disabled={!hasWorkspacePicker || !onSelectWorkspace}
                  aria-label={t("memory.workspacePickerLabel")}
                >
                  {hasWorkspacePicker ? (
                    workspaces.map((workspace) => (
                      <option key={workspace.id} value={workspace.id}>
                        {workspace.name || workspace.path || workspace.id}
                        {workspace.connected ? "" : " (disconnected)"}
                      </option>
                    ))
                  ) : (
                    <option value={workspaceSelectValue}>
                      {workspaceId ?? t("memory.workspacePickerEmpty")}
                    </option>
                  )}
                </select>
              </label>
              <div className="project-memory-modal-actions">
                <button
                  type="button"
                  className="project-memory-settings-btn"
                  onClick={() => {
                    void refresh();
                  }}
                  title={t("memory.refresh")}
                  aria-label={t("memory.refresh")}
                  disabled={loading}
                >
                  <RefreshCw size={14} aria-hidden />
                </button>
                <button
                  type="button"
                  className="project-memory-settings-btn"
                  onClick={() => setShowSettings((prev) => !prev)}
                  title={t("memory.settings")}
                  aria-label={t("memory.settings")}
                >
                  <Settings2 size={14} aria-hidden />
                </button>
                <button
                  type="button"
                  className="project-memory-settings-btn"
                  onClick={() => setShowHelp((prev) => !prev)}
                  title={t("memory.help")}
                  aria-label={t("memory.help")}
                >
                  <HelpCircle size={14} aria-hidden />
                </button>
                <button
                  type="button"
                  className="project-memory-settings-btn"
                  onClick={closeManager}
                  title={t("memory.closeManager")}
                  aria-label={t("memory.closeManager")}
                >
                  <X size={14} aria-hidden />
                </button>
              </div>
            </div>
            {renderManagerBody(true)}
          </div>
        </div>
      )}
    </>
  );
}
