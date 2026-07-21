import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Virtualizer } from "@tanstack/react-virtual";
import type { ConversationItem } from "../../../../types";
import { appendRendererDiagnostic } from "../../../../services/rendererDiagnostics";
import type { TimelineProjectionRow } from "../projection/messagesTimelineProjection";
import {
  countHydratedHeavyTimelineRows,
  deriveTimelineRowHydrationStates,
  type TimelineRowHydrationState,
} from "../virtualization/messagesTimelineHydration";
import {
  remeasureTimelineVirtualizerRows,
  TIMELINE_LIGHTWEIGHT_ROW_PLACEHOLDER_HEIGHT,
} from "../virtualization/messagesTimelineVirtualization";
import {
  DEFAULT_HYDRATION_REMEASURE_BUDGET,
  resolveHydrationRemeasureGuard,
  type HydrationRemeasureBudget,
} from "../virtualization/messagesRenderLoopGuards";

const TIMELINE_HYDRATION_REMEASURE_DIAGNOSTIC_COOLDOWN_MS = 5_000;

export function useMessagesTimelineHydration(input: {
  activeLiveTimelineRowKeys: string[];
  activeLiveTimelineRowKeySet: Set<string>;
  conversationDetailHydrationRequested: boolean;
  effectiveConversationLightweightMode: boolean;
  isThinking: boolean;
  isWorking: boolean;
  liveAssistantItem: Extract<ConversationItem, { kind: "message" }> | null;
  liveReasoningItem: Extract<ConversationItem, { kind: "reasoning" }> | null;
  pendingJumpRowKey: string | null;
  rendererOptionsKey: string;
  retainedScopeKey: string;
  shouldDeferHeavyTimelineRows: boolean;
  shouldVirtualizeTimeline: boolean;
  threadId: string | null;
  timelineProjectionRows: TimelineProjectionRow[];
  timelineVirtualizer: Virtualizer<HTMLDivElement, Element>;
  visibleTimelineRowKeySet: Set<string>;
  workspaceId: string | null;
}) {
  const {
    activeLiveTimelineRowKeys,
    activeLiveTimelineRowKeySet,
    conversationDetailHydrationRequested,
    effectiveConversationLightweightMode,
    isThinking,
    isWorking,
    liveAssistantItem,
    liveReasoningItem,
    pendingJumpRowKey,
    rendererOptionsKey,
    retainedScopeKey,
    shouldDeferHeavyTimelineRows,
    shouldVirtualizeTimeline,
    threadId,
    timelineProjectionRows,
    timelineVirtualizer,
    visibleTimelineRowKeySet,
    workspaceId,
  } = input;
  const retainedHydratedTimelineRowKeysRef = useRef<{
    scopeKey: string;
    rowKeys: Set<string>;
  }>({ scopeKey: "", rowKeys: new Set() });
  const hydrationRemeasureBudgetRef = useRef<HydrationRemeasureBudget>(
    DEFAULT_HYDRATION_REMEASURE_BUDGET,
  );
  const lightweightRemeasureBudgetRef = useRef<HydrationRemeasureBudget>(
    DEFAULT_HYDRATION_REMEASURE_BUDGET,
  );
  const liveRowRemeasureBudgetRef = useRef<HydrationRemeasureBudget>(
    DEFAULT_HYDRATION_REMEASURE_BUDGET,
  );
  const hydrationRemeasureRafRef = useRef<number | null>(null);
  const lightweightRemeasureRafRef = useRef<number | null>(null);
  const liveRowRemeasureRafRef = useRef<number | null>(null);

  useEffect(() => {
    hydrationRemeasureBudgetRef.current = DEFAULT_HYDRATION_REMEASURE_BUDGET;
    lightweightRemeasureBudgetRef.current = DEFAULT_HYDRATION_REMEASURE_BUDGET;
    liveRowRemeasureBudgetRef.current = DEFAULT_HYDRATION_REMEASURE_BUDGET;
    for (const ref of [
      hydrationRemeasureRafRef,
      lightweightRemeasureRafRef,
      liveRowRemeasureRafRef,
    ]) {
      if (typeof window !== "undefined" && ref.current !== null) {
        window.cancelAnimationFrame(ref.current);
        ref.current = null;
      }
    }
  }, [threadId, workspaceId]);

  useEffect(() => () => {
    for (const ref of [
      hydrationRemeasureRafRef,
      lightweightRemeasureRafRef,
      liveRowRemeasureRafRef,
    ]) {
      if (typeof window !== "undefined" && ref.current !== null) {
        window.cancelAnimationFrame(ref.current);
        ref.current = null;
      }
    }
  }, []);

  const retainedHydratedTimelineRowKeys = useMemo(() => {
    const retained = retainedHydratedTimelineRowKeysRef.current;
    if (retained.scopeKey !== retainedScopeKey) {
      retained.scopeKey = retainedScopeKey;
      retained.rowKeys = new Set();
    }
    return retained.rowKeys;
  }, [retainedScopeKey]);
  const timelineRowHydrationStates = useMemo(() => {
    if (isThinking || isWorking) {
      return timelineProjectionRows.map((row) => ({
        rowKey: row.key,
        contentHash: `${rendererOptionsKey}:${row.key}`,
        rendererOptionsKey,
        renderWeight: 1,
        heavy: false,
        mode: "static" as const,
        hydrationReason: "not-heavy" as const,
      }));
    }
    const nextStates = deriveTimelineRowHydrationStates({
      rows: timelineProjectionRows,
      shouldVirtualize: shouldDeferHeavyTimelineRows,
      visibleRowKeys: shouldVirtualizeTimeline ? visibleTimelineRowKeySet : new Set<string>(),
      activeRowKeys: activeLiveTimelineRowKeySet,
      retainedHydratedRowKeys: retainedHydratedTimelineRowKeys,
      anchorTargetRowKey: pendingJumpRowKey,
      detailHydrationRequested: conversationDetailHydrationRequested,
      rendererOptionsKey,
    });
    for (const state of nextStates) {
      if (state.heavy && state.mode === "hydrated") {
        retainedHydratedTimelineRowKeys.add(state.rowKey);
      }
    }
    return nextStates;
  }, [
    activeLiveTimelineRowKeySet,
    conversationDetailHydrationRequested,
    isThinking,
    isWorking,
    pendingJumpRowKey,
    rendererOptionsKey,
    retainedHydratedTimelineRowKeys,
    shouldDeferHeavyTimelineRows,
    shouldVirtualizeTimeline,
    timelineProjectionRows,
    visibleTimelineRowKeySet,
  ]);
  const hydratedHeavyTimelineRowCount = useMemo(
    () => countHydratedHeavyTimelineRows(timelineRowHydrationStates),
    [timelineRowHydrationStates],
  );
  const timelineRowHydrationStateByKey = useMemo(
    () => new Map(timelineRowHydrationStates.map((state) => [state.rowKey, state])),
    [timelineRowHydrationStates],
  );
  const shouldRenderLightweightProjectionRow = useCallback((
    row: TimelineProjectionRow,
    hydrationState: TimelineRowHydrationState | undefined,
  ) => {
    if (row.kind !== "entry" || !hydrationState?.heavy) {
      return false;
    }
    if (
      hydrationState.hydrationReason === "active" ||
      hydrationState.hydrationReason === "anchor" ||
      isThinking ||
      isWorking
    ) {
      return false;
    }
    if (effectiveConversationLightweightMode && !conversationDetailHydrationRequested) {
      return true;
    }
    if (hydrationState.mode === "hydrated") {
      return false;
    }
    return effectiveConversationLightweightMode || hydrationState.mode === "summary";
  }, [
    conversationDetailHydrationRequested,
    effectiveConversationLightweightMode,
    isThinking,
    isWorking,
  ]);
  const lightweightTimelineRowSignature = useMemo(
    () => timelineProjectionRows
      .filter((row) => shouldRenderLightweightProjectionRow(
        row,
        timelineRowHydrationStateByKey.get(row.key),
      ))
      .map((row) => row.key)
      .join("|"),
    [shouldRenderLightweightProjectionRow, timelineProjectionRows, timelineRowHydrationStateByKey],
  );
  const hydratedHeavyTimelineRowSignature = useMemo(
    () => timelineRowHydrationStates
      .filter((state) => state.heavy && state.mode === "hydrated")
      .map((state) => `${state.rowKey}:${state.contentHash}:${state.hydrationReason}`)
      .join("|"),
    [timelineRowHydrationStates],
  );
  const liveRowRemeasureSignature = useMemo(() => {
    const assistantTextLength = liveAssistantItem?.text.length ?? 0;
    const reasoningTextLength =
      (liveReasoningItem?.summary.length ?? 0) + (liveReasoningItem?.content.length ?? 0);
    return [
      liveAssistantItem?.id ?? "",
      Math.floor(assistantTextLength / 600),
      liveReasoningItem?.id ?? "",
      Math.floor(reasoningTextLength / 600),
      activeLiveTimelineRowKeys.join(","),
    ].join(":");
  }, [
    activeLiveTimelineRowKeys,
    liveAssistantItem?.id,
    liveAssistantItem?.text.length,
    liveReasoningItem?.content.length,
    liveReasoningItem?.id,
    liveReasoningItem?.summary.length,
  ]);

  useEffect(() => {
    if (
      !shouldVirtualizeTimeline ||
      lightweightTimelineRowSignature.length === 0 ||
      typeof window === "undefined"
    ) {
      if (typeof window !== "undefined" && lightweightRemeasureRafRef.current !== null) {
        window.cancelAnimationFrame(lightweightRemeasureRafRef.current);
        lightweightRemeasureRafRef.current = null;
      }
      return;
    }
    const recovery = resolveHydrationRemeasureGuard({
      previous: lightweightRemeasureBudgetRef.current,
      signature: lightweightTimelineRowSignature,
      hydratedHeavyRowCount: 1,
      now: Date.now(),
    });
    lightweightRemeasureBudgetRef.current = recovery.nextBudget;
    if (!recovery.shouldRemeasure) {
      return;
    }
    if (lightweightRemeasureRafRef.current !== null) {
      window.cancelAnimationFrame(lightweightRemeasureRafRef.current);
    }
    lightweightRemeasureRafRef.current = window.requestAnimationFrame(() => {
      lightweightRemeasureRafRef.current = null;
      timelineProjectionRows.forEach((row, index) => {
        if (shouldRenderLightweightProjectionRow(
          row,
          timelineRowHydrationStateByKey.get(row.key),
        )) {
          timelineVirtualizer.resizeItem(index, TIMELINE_LIGHTWEIGHT_ROW_PLACEHOLDER_HEIGHT);
        }
      });
      remeasureTimelineVirtualizerRows(timelineVirtualizer);
    });
  }, [
    lightweightTimelineRowSignature,
    shouldRenderLightweightProjectionRow,
    shouldVirtualizeTimeline,
    timelineProjectionRows,
    timelineRowHydrationStateByKey,
    timelineVirtualizer,
  ]);

  useEffect(() => {
    if (
      !shouldVirtualizeTimeline ||
      activeLiveTimelineRowKeys.length === 0 ||
      typeof window === "undefined"
    ) {
      return;
    }
    const recovery = resolveHydrationRemeasureGuard({
      previous: liveRowRemeasureBudgetRef.current,
      signature: liveRowRemeasureSignature,
      hydratedHeavyRowCount: 1,
      now: Date.now(),
    });
    liveRowRemeasureBudgetRef.current = recovery.nextBudget;
    if (!recovery.shouldRemeasure) {
      return;
    }
    if (liveRowRemeasureRafRef.current !== null) {
      window.cancelAnimationFrame(liveRowRemeasureRafRef.current);
    }
    liveRowRemeasureRafRef.current = window.requestAnimationFrame(() => {
      liveRowRemeasureRafRef.current = null;
      remeasureTimelineVirtualizerRows(timelineVirtualizer);
    });
  }, [
    activeLiveTimelineRowKeys.length,
    liveRowRemeasureSignature,
    shouldVirtualizeTimeline,
    timelineVirtualizer,
  ]);

  useEffect(() => {
    if (!shouldVirtualizeTimeline || hydratedHeavyTimelineRowCount <= 0) {
      hydrationRemeasureBudgetRef.current = DEFAULT_HYDRATION_REMEASURE_BUDGET;
      if (typeof window !== "undefined" && hydrationRemeasureRafRef.current !== null) {
        window.cancelAnimationFrame(hydrationRemeasureRafRef.current);
        hydrationRemeasureRafRef.current = null;
      }
      return;
    }
    const recovery = resolveHydrationRemeasureGuard({
      previous: hydrationRemeasureBudgetRef.current,
      signature: hydratedHeavyTimelineRowSignature,
      hydratedHeavyRowCount: hydratedHeavyTimelineRowCount,
      now: Date.now(),
      diagnosticCooldownMs: TIMELINE_HYDRATION_REMEASURE_DIAGNOSTIC_COOLDOWN_MS,
    });
    hydrationRemeasureBudgetRef.current = recovery.nextBudget;
    if (recovery.shouldRemeasure && typeof window !== "undefined") {
      if (hydrationRemeasureRafRef.current !== null) {
        window.cancelAnimationFrame(hydrationRemeasureRafRef.current);
      }
      hydrationRemeasureRafRef.current = window.requestAnimationFrame(() => {
        hydrationRemeasureRafRef.current = null;
        remeasureTimelineVirtualizerRows(timelineVirtualizer);
      });
    }
    if (!recovery.shouldDiagnose) {
      return;
    }
    appendRendererDiagnostic("messages/timeline-hydration-remeasure", {
      surface: "timeline-virtualizer",
      component: "MessagesTimeline",
      threadId,
      workspaceId,
      hydratedHeavyRowCount: hydratedHeavyTimelineRowCount,
      remeasureCount: recovery.nextBudget.remeasureCount,
      remeasureSuppressed: recovery.remeasureSuppressed,
      threshold: "bounded-hydration-remeasure",
    });
  }, [
    hydratedHeavyTimelineRowCount,
    hydratedHeavyTimelineRowSignature,
    shouldVirtualizeTimeline,
    threadId,
    timelineVirtualizer,
    workspaceId,
  ]);

  return {
    hydratedHeavyTimelineRowCount,
    shouldRenderLightweightProjectionRow,
    timelineRowHydrationStateByKey,
  };
}
