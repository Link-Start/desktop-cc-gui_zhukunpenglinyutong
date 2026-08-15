import type { TFunction } from "i18next";
import type { ProjectMemoryItem } from "../../../services/tauri";
import { projectMemoryFacade } from "../services/projectMemoryFacade";
import { isLikelyPollutedMemory } from "../utils/memoryMarkers";
import {
  resolveProjectMemoryCompactSummary,
  resolveProjectMemoryCompactTitle,
  resolveProjectMemoryDetailText,
  type ProjectMemoryReviewState,
  type ProjectMemorySourceLocator,
} from "../utils/projectMemoryDisplay";
import { parseTagTerms } from "./projectMemoryPanelHelpers";
import type { ProjectMemoryPanelLabels } from "./projectMemoryPanelLabels";

type UseProjectMemoryPanelActionsArgs = {
  workspaceId: string | null;
  items: ProjectMemoryItem[];
  selectedItem: ProjectMemoryItem | null;
  selectedIsConversationTurn: boolean;
  selectedSourceLocator: ProjectMemorySourceLocator | null;
  selectedIds: Set<string>;
  pollutionCandidateIds: string[];
  detailTextDraft: string;
  tag: string;
  total: number;
  t: TFunction;
  labels: ProjectMemoryPanelLabels;
  refresh: () => Promise<void>;
  updateMemory: (
    id: string,
    patch: Parameters<typeof projectMemoryFacade.update>[2],
  ) => Promise<unknown>;
  deleteMemory: (id: string) => Promise<unknown>;
  setPollutionBusy: (value: "scan" | "cleanup" | null) => void;
  setPollutionMessage: (value: string | null) => void;
  setPollutionScannedTotal: (value: number) => void;
  setPollutionCandidateIds: (value: string[]) => void;
  setDeleteError: (value: string | null) => void;
  setShowDeleteConfirm: (value: boolean) => void;
  setDetailSaving: (value: boolean) => void;
  setCopyMessage: (value: string | null) => void;
  setDiagnosticsBusy: (value: "diagnostics" | "dry-run" | "apply" | null) => void;
  setDiagnostics: (value: Awaited<ReturnType<typeof projectMemoryFacade.diagnostics>> | null) => void;
  setReconcileResult: (value: Awaited<ReturnType<typeof projectMemoryFacade.reconcile>> | null) => void;
  setShowReconcileApplyConfirm: (value: boolean) => void;
  setSelectedIds: (value: Set<string>) => void;
  setShowBatchDeleteConfirm: (value: boolean) => void;
  setShowClearAllConfirm: (value: boolean) => void;
  setBatchUpdating: (value: boolean) => void;
  setTag: (value: string) => void;
};

export function useProjectMemoryPanelActions(args: UseProjectMemoryPanelActionsArgs) {
  const {
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
  } = args;

  const handleScanPollutedMemories = async () => {
    if (!workspaceId) {
      return;
    }
    setPollutionBusy("scan");
    setPollutionMessage(null);
    try {
      const hitIds: string[] = [];
      let scanned = 0;
      let currentPage = 0;
      const scanPageSize = 200;
      let hasNextPage = true;
      while (hasNextPage) {
        const response = await projectMemoryFacade.list({
          workspaceId,
          page: currentPage,
          pageSize: scanPageSize,
          importance: null,
          kind: null,
          query: null,
          tag: null,
        });
        if (!response.items.length) {
          break;
        }
        scanned += response.items.length;
        response.items.forEach((item) => {
          if (isLikelyPollutedMemory(item)) {
            hitIds.push(item.id);
          }
        });
        hasNextPage = (currentPage + 1) * scanPageSize < response.total;
        if (hasNextPage) {
          currentPage += 1;
        }
      }
      setPollutionScannedTotal(scanned);
      setPollutionCandidateIds(hitIds);
      setPollutionMessage(
        t("memory.cleanupPreview", {
          matched: hitIds.length,
          scanned,
        }),
      );
    } catch (err) {
      setPollutionMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setPollutionBusy(null);
    }
  };

  const handleCleanupPollutedMemories = async () => {
    if (!workspaceId || pollutionCandidateIds.length === 0) {
      return;
    }
    setPollutionBusy("cleanup");
    setPollutionMessage(null);
    try {
      const settled = await Promise.allSettled(
        pollutionCandidateIds.map((id) => projectMemoryFacade.delete(id, workspaceId)),
      );
      const successCount = settled.filter((entry) => entry.status === "fulfilled").length;
      const failedCount = settled.length - successCount;
      setPollutionCandidateIds([]);
      setPollutionScannedTotal(0);
      setPollutionMessage(
        t("memory.cleanupResult", {
          success: successCount,
          failed: failedCount,
        }),
      );
      if (successCount > 0) {
        await refresh();
      }
    } catch (err) {
      setPollutionMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setPollutionBusy(null);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) {
      return;
    }
    setDeleteError(null);
    setShowDeleteConfirm(true);
  };

  const handleSaveManualDetail = async () => {
    if (!selectedItem || selectedIsConversationTurn) {
      return;
    }
    setDetailSaving(true);
    setDeleteError(null);
    try {
      await updateMemory(selectedItem.id, {
        detail: detailTextDraft,
        source: selectedItem.source || "manual",
      });
      setPollutionMessage(t("memory.detailSaved"));
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
    } finally {
      setDetailSaving(false);
    }
  };

  const handleCopySelectedTurn = async () => {
    if (!selectedItem || !selectedIsConversationTurn) {
      return;
    }
    setCopyMessage(null);
    const copyText = resolveProjectMemoryDetailText(selectedItem, {
      userInput: t("memory.turnUserInput"),
      assistantResponse: t("memory.turnAssistantResponse"),
      assistantThinkingSummary: t("memory.turnAssistantThinkingSummary"),
    });
    try {
      if (!navigator.clipboard) {
        throw new Error(t("memory.copyUnavailable"));
      }
      await navigator.clipboard.writeText(copyText);
      setCopyMessage(t("memory.copyTurnSuccess"));
    } catch (err) {
      setCopyMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCopySourceLocator = async () => {
    if (!selectedSourceLocator?.available) {
      return;
    }
    const lines = [
      selectedSourceLocator.threadId ? `threadId: ${selectedSourceLocator.threadId}` : null,
      selectedSourceLocator.turnId ? `turnId: ${selectedSourceLocator.turnId}` : null,
      selectedSourceLocator.engine ? `engine: ${selectedSourceLocator.engine}` : null,
    ].filter((entry): entry is string => Boolean(entry));
    try {
      if (!navigator.clipboard) {
        throw new Error(t("memory.copyUnavailable"));
      }
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopyMessage(t("memory.sourceLocatorCopied"));
    } catch (err) {
      setCopyMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSetReviewState = async (nextReviewState: ProjectMemoryReviewState) => {
    if (!selectedItem) {
      return;
    }
    setDetailSaving(true);
    setDeleteError(null);
    try {
      await updateMemory(selectedItem.id, {
        reviewState: nextReviewState,
      });
      setPollutionMessage(
        t("memory.reviewStateUpdated", {
          state: labels.reviewStateLabel(nextReviewState),
        }),
      );
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
    } finally {
      setDetailSaving(false);
    }
  };

  const handleConvertToManualNote = async () => {
    if (!workspaceId || !selectedItem) {
      return;
    }
    setDetailSaving(true);
    setDeleteError(null);
    try {
      await projectMemoryFacade.create({
        workspaceId,
        recordKind: "manual_note",
        kind: "note",
        title: resolveProjectMemoryCompactTitle(selectedItem),
        summary: resolveProjectMemoryCompactSummary(selectedItem),
        detail: resolveProjectMemoryDetailText(selectedItem, {
          userInput: t("memory.turnUserInput"),
          assistantResponse: t("memory.turnAssistantResponse"),
          assistantThinkingSummary: t("memory.turnAssistantThinkingSummary"),
        }),
        tags: selectedItem.tags,
        importance: selectedItem.importance,
        source: "manual",
      });
      await updateMemory(selectedItem.id, {
        reviewState: "converted",
      });
      setPollutionMessage(t("memory.reviewConverted"));
      await refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
    } finally {
      setDetailSaving(false);
    }
  };

  const handleRunDiagnostics = async () => {
    if (!workspaceId) {
      return;
    }
    setDiagnosticsBusy("diagnostics");
    setDeleteError(null);
    try {
      setDiagnostics(await projectMemoryFacade.diagnostics(workspaceId));
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
    } finally {
      setDiagnosticsBusy(null);
    }
  };

  const handleRunReconcileDryRun = async () => {
    if (!workspaceId) {
      return;
    }
    setDiagnosticsBusy("dry-run");
    setDeleteError(null);
    try {
      const result = await projectMemoryFacade.reconcile(workspaceId, true);
      setReconcileResult(result);
      setPollutionMessage(t("memory.reconcileDryRunDone", { count: result.fixableCount }));
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
    } finally {
      setDiagnosticsBusy(null);
    }
  };

  const handleApplyReconcile = async () => {
    if (!workspaceId) {
      return;
    }
    setShowReconcileApplyConfirm(false);
    setDiagnosticsBusy("apply");
    setDeleteError(null);
    try {
      const result = await projectMemoryFacade.reconcile(workspaceId, false);
      setReconcileResult(result);
      setPollutionMessage(t("memory.reconcileApplyDone", { count: result.fixedCount }));
      await refresh();
      setDiagnostics(await projectMemoryFacade.diagnostics(workspaceId));
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
    } finally {
      setDiagnosticsBusy(null);
    }
  };

  const confirmDelete = async () => {
    if (!selectedItem) {
      return;
    }
    setDeleteError(null);
    try {
      await deleteMemory(selectedItem.id);
      setShowDeleteConfirm(false);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((item) => item.id)));
    }
  };

  const toggleQuickTag = (targetTag: string) => {
    const terms = parseTagTerms(tag);
    const hasTag = terms.includes(targetTag);
    const nextTerms = hasTag ? terms.filter((entry) => entry !== targetTag) : [...terms, targetTag];
    setTag(nextTerms.join(", "));
  };

  const toggleSelectItem = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleBatchSetImportance = async (nextImportance: "high" | "medium" | "low") => {
    if (!workspaceId || selectedIds.size === 0) {
      return;
    }
    setBatchUpdating(true);
    setDeleteError(null);
    try {
      const settled = await Promise.allSettled(
        Array.from(selectedIds).map((id) =>
          projectMemoryFacade.update(id, workspaceId, { importance: nextImportance }),
        ),
      );
      const successCount = settled.filter((entry) => entry.status === "fulfilled").length;
      setPollutionMessage(
        t("memory.batchUpdateImportanceSuccess", {
          count: successCount,
          importance: labels.importanceLabel(nextImportance),
        }),
      );
      if (successCount > 0) {
        await refresh();
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
    } finally {
      setBatchUpdating(false);
    }
  };

  const handleBatchDelete = async () => {
    if (!workspaceId || selectedIds.size === 0) {
      return;
    }
    setShowBatchDeleteConfirm(false);
    setBatchUpdating(true);
    setDeleteError(null);
    try {
      const settled = await Promise.allSettled(
        Array.from(selectedIds).map((id) => projectMemoryFacade.delete(id, workspaceId)),
      );
      const successCount = settled.filter((entry) => entry.status === "fulfilled").length;
      setSelectedIds(new Set());
      setPollutionMessage(t("memory.batchDeleteSuccess", { count: successCount }));
      await refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
    } finally {
      setBatchUpdating(false);
    }
  };

  const handleClearAll = async () => {
    if (!workspaceId || total === 0) {
      return;
    }
    setShowClearAllConfirm(false);
    setDeleteError(null);
    try {
      const allIds: string[] = [];
      let currentPage = 0;
      const scanPageSize = 200;
      let hasNextPage = true;
      while (hasNextPage) {
        const response = await projectMemoryFacade.list({
          workspaceId,
          page: currentPage,
          pageSize: scanPageSize,
          importance: null,
          kind: null,
          query: null,
          tag: null,
        });
        if (!response.items.length) {
          break;
        }
        allIds.push(...response.items.map((item) => item.id));
        hasNextPage = (currentPage + 1) * scanPageSize < response.total;
        if (hasNextPage) {
          currentPage += 1;
        }
      }
      const settled = await Promise.allSettled(
        allIds.map((id) => projectMemoryFacade.delete(id, workspaceId)),
      );
      const successCount = settled.filter((entry) => entry.status === "fulfilled").length;
      setSelectedIds(new Set());
      setPollutionMessage(t("memory.clearAllSuccess", { count: successCount }));
      await refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
    }
  };

  return {
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
  };
}
