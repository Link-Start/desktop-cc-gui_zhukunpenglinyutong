import { memo, useMemo } from "react";
import {
  getGitHistoryGraphLaneColor,
  getGitHistoryGraphRowWidth,
  GIT_HISTORY_GRAPH_LANE_WIDTH,
  GIT_HISTORY_GRAPH_LEFT_PAD,
  GIT_HISTORY_GRAPH_NODE_RADIUS,
  GIT_HISTORY_GRAPH_ROW_HEIGHT,
  type GitHistoryGraphRow,
} from "../utils/gitHistoryGraphLayout";

export type GitHistoryGraphCellProps = {
  row: GitHistoryGraphRow | null | undefined;
  /**
   * @deprecated Global lane count is no longer used for width. Kept optional so
   * callers can pass it without effect during transition.
   */
  laneCount?: number;
  /** Row height in px (should match virtualizer estimate). */
  height?: number;
  /** Highlight node when the commit row is selected. */
  active?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
};

function laneX(lane: number, laneWidth: number, leftPad: number): number {
  return leftPad + laneWidth * lane + laneWidth / 2;
}

function buildEdgePath(
  fromLane: number,
  toLane: number,
  height: number,
  laneWidth: number,
  leftPad: number,
  kind: "parent" | "merge" | "pass",
): string {
  const x0 = laneX(fromLane, laneWidth, leftPad);
  const x1 = laneX(toLane, laneWidth, leftPad);
  const midY = height / 2;

  if (kind === "pass") {
    // Vertical through-line, or diagonal after left-pack remaps the bottom lane.
    if (fromLane === toLane) {
      return `M ${x0} 0 L ${x0} ${height}`;
    }
    const controlY = height * 0.5;
    return `M ${x0} 0 C ${x0} ${controlY}, ${x1} ${controlY}, ${x1} ${height}`;
  }

  // Node mid → parent bottom (possibly other lane).
  if (fromLane === toLane) {
    return `M ${x0} ${midY} L ${x0} ${height}`;
  }

  // Smooth branch/merge curve from mid to bottom of target lane.
  const controlY = midY + (height - midY) * 0.55;
  return `M ${x0} ${midY} C ${x0} ${controlY}, ${x1} ${controlY}, ${x1} ${height}`;
}

/**
 * Per-row SVG slice of the multi-lane commit graph.
 *
 * Width is derived from this row's `laneSpan` only, so commits hug the graph
 * instead of reserving empty columns for branches that are inactive here.
 */
export const GitHistoryGraphCell = memo(function GitHistoryGraphCell({
  row,
  height = GIT_HISTORY_GRAPH_ROW_HEIGHT,
  active = false,
  isFirst = false,
  isLast = false,
}: GitHistoryGraphCellProps) {
  const laneWidth = GIT_HISTORY_GRAPH_LANE_WIDTH;
  const leftPad = GIT_HISTORY_GRAPH_LEFT_PAD;
  const laneSpan = Math.max(1, row?.laneSpan ?? 1);
  const width = getGitHistoryGraphRowWidth(laneSpan);
  const nodeRadius = GIT_HISTORY_GRAPH_NODE_RADIUS;

  const content = useMemo(() => {
    if (!row) {
      return null;
    }

    const midY = height / 2;
    const nodeX = laneX(row.lane, laneWidth, leftPad);
    const nodeColor = getGitHistoryGraphLaneColor(row.lane);

    // Top stubs into the node for the node's own lane (so the line meets the circle).
    const topStub =
      isFirst
        ? null
        : (
          <line
            key="top-stub"
            x1={nodeX}
            y1={0}
            x2={nodeX}
            y2={midY}
            stroke={nodeColor}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        );

    const edgeElements = row.edges.map((edge, index) => {
      // Pass edges: full height. Parent/merge: mid → bottom.
      // For the node's own parent continuing same lane, top stub already covers top half.
      if (edge.kind === "pass") {
        return (
          <path
            key={`pass-${edge.fromLane}-${index}`}
            d={buildEdgePath(
              edge.fromLane,
              edge.toLane,
              height,
              laneWidth,
              leftPad,
              "pass",
            )}
            fill="none"
            stroke={getGitHistoryGraphLaneColor(edge.colorLane)}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        );
      }

      if (isLast && edge.fromLane === edge.toLane) {
        // Root-ish last row: short stub under the node only.
        const x = laneX(edge.fromLane, laneWidth, leftPad);
        return (
          <line
            key={`end-${edge.kind}-${edge.toLane}-${index}`}
            x1={x}
            y1={midY}
            x2={x}
            y2={midY + 8}
            stroke={getGitHistoryGraphLaneColor(edge.colorLane)}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        );
      }

      return (
        <path
          key={`${edge.kind}-${edge.fromLane}-${edge.toLane}-${index}`}
          d={buildEdgePath(
            edge.fromLane,
            edge.toLane,
            height,
            laneWidth,
            leftPad,
            edge.kind,
          )}
          fill="none"
          stroke={getGitHistoryGraphLaneColor(edge.colorLane)}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      );
    });

    return (
      <>
        {topStub}
        {edgeElements}
        <circle
          cx={nodeX}
          cy={midY}
          r={active ? nodeRadius + 0.75 : nodeRadius}
          fill={nodeColor}
          stroke="var(--git-history-pane-bg, var(--background, #fff))"
          strokeWidth={active ? 2.25 : 1.75}
        />
      </>
    );
  }, [active, height, isFirst, isLast, laneWidth, leftPad, nodeRadius, row]);

  return (
    <span
      className={`git-history-graph${active ? " is-active" : ""}${isFirst ? " is-first" : ""}${isLast ? " is-last" : ""}`}
      style={{ width }}
      aria-hidden
    >
      <svg
        className="git-history-graph-svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        focusable="false"
      >
        {content}
      </svg>
    </span>
  );
});
