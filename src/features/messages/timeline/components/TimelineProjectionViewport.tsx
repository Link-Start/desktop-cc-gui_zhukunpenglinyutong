import { Fragment, type ReactNode } from "react";
import type { VirtualItem } from "@tanstack/react-virtual";
import { useRenderHotspot } from "../../../../services/perfBaseline/useRenderHotspot";
import type { MessagesEngine } from "../../utils/messagesRenderUtils";
import type { TimelineProjectionRow } from "../projection/messagesTimelineProjection";
import type { TimelineRowHydrationState } from "../virtualization/messagesTimelineHydration";
import {
  estimateTimelineProjectionRowSize,
  isEmptyVirtualProjectionRow,
  resolveVirtualizedTimelineRowVisualHeight,
} from "../virtualization/messagesTimelineVirtualization";

type TimelineProjectionViewportProps = {
  activeEngine: MessagesEngine;
  activeLiveTimelineRowKeySet: Set<string>;
  claudeHistoryTranscriptFallbackActive: boolean;
  effectiveItemsCount: number;
  isThinking: boolean;
  isWorking: boolean;
  lastDurationMs: number | null;
  measureTimelineVirtualRowElement: (node: HTMLDivElement | null) => void;
  renderProjectionRow: (row: TimelineProjectionRow | undefined) => ReactNode;
  shouldRenderLightweightProjectionRow: (
    row: TimelineProjectionRow,
    hydrationState: TimelineRowHydrationState | undefined,
  ) => boolean;
  shouldVirtualizeTimeline: boolean;
  timelineProjectionRows: TimelineProjectionRow[];
  timelineRowHydrationStateByKey: Map<string, TimelineRowHydrationState>;
  totalSize: number;
  userInputNodePresent: boolean;
  virtualTimelineRows: VirtualItem[];
};

function TimelineActiveRowRenderProbe({
  children,
  detail,
  enabled,
}: {
  children: ReactNode;
  detail: string;
  enabled: boolean;
}) {
  useRenderHotspot("timeline-active-row-render", detail, enabled);
  return <>{children}</>;
}

export function TimelineProjectionViewport({
  activeEngine,
  activeLiveTimelineRowKeySet,
  claudeHistoryTranscriptFallbackActive,
  effectiveItemsCount,
  isThinking,
  isWorking,
  lastDurationMs,
  measureTimelineVirtualRowElement,
  renderProjectionRow,
  shouldRenderLightweightProjectionRow,
  shouldVirtualizeTimeline,
  timelineProjectionRows,
  timelineRowHydrationStateByKey,
  totalSize,
  userInputNodePresent,
  virtualTimelineRows,
}: TimelineProjectionViewportProps) {
  if (!shouldVirtualizeTimeline) {
    return timelineProjectionRows.map((row) => (
      <Fragment key={row.key}>{renderProjectionRow(row)}</Fragment>
    ));
  }

  return (
    <div
      className="messages-virtualized-canvas"
      style={{
        height: `${totalSize}px`,
        position: "relative",
      }}
    >
      {virtualTimelineRows.map((virtualRow) => {
        const row = timelineProjectionRows[virtualRow.index];
        const isActiveLiveTimelineRow = activeLiveTimelineRowKeySet.has(String(virtualRow.key));
        const hydrationState = row ? timelineRowHydrationStateByKey.get(row.key) : undefined;
        const isLightweightTimelineRow = row
          ? shouldRenderLightweightProjectionRow(row, hydrationState)
          : false;
        const estimatedRowSize = estimateTimelineProjectionRowSize(row ?? {
          kind: "bottomAnchor",
          key: "bottom-anchor",
        });
        const isEmptyTimelineRow = row
          ? isEmptyVirtualProjectionRow(row, {
              activeEngine,
              claudeHistoryTranscriptFallbackActive,
              hasTailUserInputNode: userInputNodePresent,
              isWorking,
              lastDurationMs,
              effectiveItemsCount,
            })
          : false;
        const placeholderHeight = isEmptyTimelineRow
          ? 0
          : resolveVirtualizedTimelineRowVisualHeight({
              measuredSize: virtualRow.size,
              estimatedSize: estimatedRowSize,
              lightweight: isLightweightTimelineRow,
            });
        const activeRowProbeDetail = [
          row?.kind ?? "missing",
          isLightweightTimelineRow ? "lightweight" : "hydrated",
          `index=${virtualRow.index}`,
          `rows=${timelineProjectionRows.length}`,
          `key=${String(virtualRow.key).slice(0, 80)}`,
        ].join(":");

        return (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            data-active-live-row={isActiveLiveTimelineRow ? "true" : undefined}
            data-conversation-lightweight-virtual-row={isLightweightTimelineRow ? "true" : undefined}
            data-timeline-row-kind={row?.kind}
            data-empty-virtual-row={isEmptyTimelineRow ? "true" : undefined}
            data-virtual-row-size={placeholderHeight}
            className={
              isEmptyTimelineRow
                ? "messages-virtualized-row is-empty-virtual-row"
                : isActiveLiveTimelineRow
                  ? "messages-virtualized-row is-active-live-row"
                  : "messages-virtualized-row"
            }
            ref={isEmptyTimelineRow ? undefined : measureTimelineVirtualRowElement}
            style={{
              left: 0,
              height: isEmptyTimelineRow ? 0 : undefined,
              minHeight: isLightweightTimelineRow ? `${placeholderHeight}px` : undefined,
              position: "absolute",
              top: 0,
              transform: `translateY(${virtualRow.start}px)`,
              width: "100%",
            }}
          >
            {isEmptyTimelineRow ? null : (
              <TimelineActiveRowRenderProbe
                detail={activeRowProbeDetail}
                enabled={(isThinking || isWorking) && isActiveLiveTimelineRow}
              >
                {renderProjectionRow(row)}
              </TimelineActiveRowRenderProbe>
            )}
          </div>
        );
      })}
    </div>
  );
}
