import { useCallback, useEffect, useMemo, useRef } from "react";
import { useVirtualizer, type Virtualizer } from "@tanstack/react-virtual";
import { trackHotspot } from "../../../../services/perfBaseline/hotspotTracker";
import { useRenderHotspot } from "../../../../services/perfBaseline/useRenderHotspot";
import { appendRendererDiagnostic } from "../../../../services/rendererDiagnostics";
import type { MessagesEngine } from "../../utils/messagesRenderUtils";
import type { TimelineProjectionRow } from "../projection/messagesTimelineProjection";
import {
  classifyTimelineVirtualizerStability,
  DEFAULT_TIMELINE_VIRTUALIZER_STABILITY_RECOVERY_BUDGET,
  estimateTimelineProjectionRowSize,
  isEmptyVirtualProjectionRow,
  observeTimelineElementOffset,
  remeasureTimelineVirtualizerRows,
  resolveTimelineVirtualizerStabilityRecovery,
  resolveTimelineCanvasOverscan,
  resolveVirtualizedTimelineScopeReset,
} from "../virtualization/messagesTimelineVirtualization";

const TIMELINE_VIRTUALIZER_STABILITY_REMEASURE_COOLDOWN_MS = 750;
const TIMELINE_VIRTUALIZER_STABILITY_DIAGNOSTIC_COOLDOWN_MS = 5_000;
const TIMELINE_LIVE_ROW_BOTTOM_PROXIMITY_PX = 720;

export function useMessagesTimelineVirtualizer(input: {
  activeEngine: MessagesEngine;
  activeLiveRowCount: number;
  claudeHistoryTranscriptFallbackActive: boolean;
  effectiveItemsCount: number;
  hasTailUserInputNode: boolean;
  isThinking: boolean;
  isWorking: boolean;
  lastDurationMs: number | null;
  renderWeight: number;
  scrollElementRef: React.RefObject<HTMLDivElement | null>;
  shouldVirtualizeTimeline: boolean;
  timelineProjectionRows: TimelineProjectionRow[];
}) {
  const {
    activeEngine,
    activeLiveRowCount,
    claudeHistoryTranscriptFallbackActive,
    effectiveItemsCount,
    hasTailUserInputNode,
    isThinking,
    isWorking,
    lastDurationMs,
    renderWeight,
    scrollElementRef,
    shouldVirtualizeTimeline,
    timelineProjectionRows,
  } = input;
  const timelineVirtualizer = useVirtualizer({
    count: shouldVirtualizeTimeline ? timelineProjectionRows.length : 0,
    enabled: shouldVirtualizeTimeline,
    estimateSize: (index) => {
      const projectionRow = timelineProjectionRows[index];
      if (!projectionRow) {
        return estimateTimelineProjectionRowSize({
          kind: "bottomAnchor",
          key: "bottom-anchor",
        });
      }
      if (
        isEmptyVirtualProjectionRow(projectionRow, {
          activeEngine,
          claudeHistoryTranscriptFallbackActive,
          hasTailUserInputNode,
          isWorking,
          lastDurationMs,
          effectiveItemsCount,
        })
      ) {
        return 0;
      }
      return estimateTimelineProjectionRowSize(projectionRow);
    },
    getItemKey: (index) => timelineProjectionRows[index]?.key ?? `missing:${index}`,
    getScrollElement: () => scrollElementRef.current,
    observeElementOffset: observeTimelineElementOffset,
    overscan: resolveTimelineCanvasOverscan({
      isThinking,
      isWorking,
      rowCount: timelineProjectionRows.length,
      renderWeight,
    }),
  });
  const virtualTimelineRows = timelineVirtualizer.getVirtualItems();
  const virtualTimelineRowKeys = useMemo(
    () => virtualTimelineRows.map((row) => row.key),
    [virtualTimelineRows],
  );
  const timelineVirtualizerRef = useRef(timelineVirtualizer);
  timelineVirtualizerRef.current = timelineVirtualizer;
  const rowCountRef = useRef(timelineProjectionRows.length);
  rowCountRef.current = timelineProjectionRows.length;
  const measureTimelineVirtualRowElement = useCallback((node: HTMLDivElement | null) => {
    if (!node) {
      return;
    }
    const detail = [
      node.dataset.timelineRowKind ?? "unknown",
      node.dataset.activeLiveRow === "true" ? "active" : "static",
      `index=${node.dataset.index ?? "?"}`,
      `size=${node.dataset.virtualRowSize ?? "?"}`,
      `rows=${rowCountRef.current}`,
    ].join(":");
    trackHotspot("timeline-row-measure", detail, () => {
      timelineVirtualizerRef.current.measureElement(node);
    });
  }, []);

  useRenderHotspot(
    "timeline-list-render",
    [
      shouldVirtualizeTimeline ? "virtual" : "static",
      `${timelineProjectionRows.length}rows`,
      `visible=${shouldVirtualizeTimeline ? virtualTimelineRows.length : timelineProjectionRows.length}`,
      `active=${activeLiveRowCount}`,
      isThinking ? "thinking" : isWorking ? "working" : "idle",
      `weight=${renderWeight}`,
    ].join(":"),
    isThinking || isWorking,
  );

  const emptyTimelineRowIndexSignature = useMemo(() => {
    if (!shouldVirtualizeTimeline) {
      return "";
    }
    const indices: number[] = [];
    timelineProjectionRows.forEach((row, index) => {
      if (
        isEmptyVirtualProjectionRow(row, {
          activeEngine,
          claudeHistoryTranscriptFallbackActive,
          hasTailUserInputNode,
          isWorking,
          lastDurationMs,
          effectiveItemsCount,
        })
      ) {
        indices.push(index);
      }
    });
    return indices.join(",");
  }, [
    activeEngine,
    claudeHistoryTranscriptFallbackActive,
    effectiveItemsCount,
    hasTailUserInputNode,
    isWorking,
    lastDurationMs,
    shouldVirtualizeTimeline,
    timelineProjectionRows,
  ]);

  useEffect(() => {
    if (!shouldVirtualizeTimeline || emptyTimelineRowIndexSignature.length === 0) {
      return;
    }
    emptyTimelineRowIndexSignature.split(",").forEach((rawIndex) => {
      const index = Number(rawIndex);
      if (Number.isInteger(index) && index >= 0) {
        timelineVirtualizer.resizeItem(index, 0);
      }
    });
  }, [emptyTimelineRowIndexSignature, shouldVirtualizeTimeline, timelineVirtualizer]);

  return {
    measureTimelineVirtualRowElement,
    timelineVirtualizer,
    virtualTimelineRowKeys,
    virtualTimelineRows,
  };
}

export function useMessagesTimelineVirtualizerLifecycle(input: {
  activeLiveTimelineRowKeys: string[];
  hydratedHeavyTimelineRowCount: number;
  isThinking: boolean;
  isWorking: boolean;
  messageNodeByIdRef: React.MutableRefObject<Map<string, HTMLDivElement>>;
  onPendingJumpTargetReady: (messageId: string) => void;
  pendingJumpMessageId: string | null;
  pendingJumpRowIndex: number;
  requestBottomConvergence: () => void;
  scrollElementRef: React.RefObject<HTMLDivElement | null>;
  shouldVirtualizeTimeline: boolean;
  threadId: string | null;
  timelineProjectionRowCount: number;
  timelineVirtualizer: Virtualizer<HTMLDivElement, Element>;
  virtualizedTimelineScopeKey: string;
  virtualTimelineRowKeys: Array<string | number | bigint>;
  workspaceId: string | null;
}) {
  const {
    activeLiveTimelineRowKeys,
    hydratedHeavyTimelineRowCount,
    isThinking,
    isWorking,
    messageNodeByIdRef,
    onPendingJumpTargetReady,
    pendingJumpMessageId,
    pendingJumpRowIndex,
    requestBottomConvergence,
    scrollElementRef,
    shouldVirtualizeTimeline,
    threadId,
    timelineProjectionRowCount,
    timelineVirtualizer,
    virtualizedTimelineScopeKey,
    virtualTimelineRowKeys,
    workspaceId,
  } = input;
  const timelineStabilityRecoveryBudgetRef = useRef(
    DEFAULT_TIMELINE_VIRTUALIZER_STABILITY_RECOVERY_BUDGET,
  );
  const scopeResetRemeasureRafRef = useRef<number | null>(null);
  const lastVirtualizedTimelineScopeResetRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && scopeResetRemeasureRafRef.current !== null) {
      window.cancelAnimationFrame(scopeResetRemeasureRafRef.current);
      scopeResetRemeasureRafRef.current = null;
    }
  }, [threadId, workspaceId]);

  useEffect(() => () => {
    if (typeof window !== "undefined" && scopeResetRemeasureRafRef.current !== null) {
      window.cancelAnimationFrame(scopeResetRemeasureRafRef.current);
      scopeResetRemeasureRafRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!pendingJumpMessageId) {
      return;
    }
    if (messageNodeByIdRef.current.get(pendingJumpMessageId)) {
      onPendingJumpTargetReady(pendingJumpMessageId);
      return;
    }
    if (!shouldVirtualizeTimeline || pendingJumpRowIndex < 0) {
      return;
    }
    timelineVirtualizer.scrollToIndex(pendingJumpRowIndex, { align: "center" });
  }, [
    messageNodeByIdRef,
    onPendingJumpTargetReady,
    pendingJumpMessageId,
    pendingJumpRowIndex,
    shouldVirtualizeTimeline,
    timelineVirtualizer,
    virtualTimelineRowKeys,
  ]);

  useEffect(() => {
    const scrollElement = scrollElementRef.current;
    const reset = resolveVirtualizedTimelineScopeReset({
      previousScopeKey: lastVirtualizedTimelineScopeResetRef.current,
      nextScopeKey: virtualizedTimelineScopeKey,
      shouldVirtualize: shouldVirtualizeTimeline,
      stableHistoryView: !isThinking && !isWorking,
      hasPendingJump: Boolean(pendingJumpMessageId),
      hasScrollElement: Boolean(scrollElement),
    });
    lastVirtualizedTimelineScopeResetRef.current = reset.nextScopeKey;
    if (!reset.shouldPinBottomWhenArmed && !reset.shouldMeasure) {
      return;
    }
    const pinScrollToBottom = scrollElement && reset.shouldPinBottomWhenArmed
      ? requestBottomConvergence
      : null;
    pinScrollToBottom?.();
    if (!reset.shouldMeasure) {
      return;
    }
    if (typeof window === "undefined") {
      remeasureTimelineVirtualizerRows(timelineVirtualizer);
      return;
    }
    if (scopeResetRemeasureRafRef.current !== null) {
      window.cancelAnimationFrame(scopeResetRemeasureRafRef.current);
    }
    scopeResetRemeasureRafRef.current = window.requestAnimationFrame(() => {
      scopeResetRemeasureRafRef.current = null;
      remeasureTimelineVirtualizerRows(timelineVirtualizer);
      pinScrollToBottom?.();
    });
  }, [
    isThinking,
    isWorking,
    pendingJumpMessageId,
    requestBottomConvergence,
    scrollElementRef,
    shouldVirtualizeTimeline,
    timelineVirtualizer,
    virtualizedTimelineScopeKey,
  ]);

  useEffect(() => {
    const scrollElement = scrollElementRef.current;
    const distanceFromBottom = scrollElement
      ? scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight
      : Number.POSITIVE_INFINITY;
    const isNearLiveTail =
      Number.isFinite(distanceFromBottom) &&
      distanceFromBottom <= TIMELINE_LIVE_ROW_BOTTOM_PROXIMITY_PX;
    const stabilityState = classifyTimelineVirtualizerStability({
      shouldVirtualize: shouldVirtualizeTimeline,
      rowCount: timelineProjectionRowCount,
      hasScrollElement: Boolean(scrollElement),
      virtualItemKeys: virtualTimelineRowKeys,
      activeLiveRowKeys: activeLiveTimelineRowKeys,
      streamingActive: Boolean((isThinking || isWorking) && isNearLiveTail),
    });
    if (stabilityState === "stable") {
      return;
    }

    const stabilitySignature = [
      stabilityState,
      timelineProjectionRowCount,
      virtualTimelineRowKeys.length,
      activeLiveTimelineRowKeys.length,
      isThinking ? "thinking" : "idle",
      isWorking ? "working" : "idle",
    ].join(":");
    const recovery = resolveTimelineVirtualizerStabilityRecovery({
      previous: timelineStabilityRecoveryBudgetRef.current,
      signature: stabilitySignature,
      now: Date.now(),
      remeasureCooldownMs: TIMELINE_VIRTUALIZER_STABILITY_REMEASURE_COOLDOWN_MS,
      diagnosticCooldownMs: TIMELINE_VIRTUALIZER_STABILITY_DIAGNOSTIC_COOLDOWN_MS,
    });
    timelineStabilityRecoveryBudgetRef.current = recovery.nextBudget;
    if (recovery.shouldRemeasure) {
      remeasureTimelineVirtualizerRows(timelineVirtualizer);
    }
    if (!recovery.shouldDiagnose) {
      return;
    }
    appendRendererDiagnostic("messages/timeline-virtualizer-stability", {
      state: stabilityState,
      threadId,
      workspaceId,
      rowCount: timelineProjectionRowCount,
      virtualItemCount: virtualTimelineRowKeys.length,
      activeLiveRowCount: activeLiveTimelineRowKeys.length,
      hydratedHeavyRowCount: hydratedHeavyTimelineRowCount,
      isThinking,
      isWorking,
      isNearLiveTail,
      recoveryRemeasureCount: recovery.nextBudget.remeasureCount,
      recoveryRemeasureSuppressed: recovery.remeasureSuppressed,
      distanceFromBottom: Number.isFinite(distanceFromBottom)
        ? Math.max(0, Math.round(distanceFromBottom))
        : null,
    });
  }, [
    activeLiveTimelineRowKeys,
    hydratedHeavyTimelineRowCount,
    isThinking,
    isWorking,
    scrollElementRef,
    shouldVirtualizeTimeline,
    threadId,
    timelineProjectionRowCount,
    timelineVirtualizer,
    virtualTimelineRowKeys,
    workspaceId,
  ]);
}
