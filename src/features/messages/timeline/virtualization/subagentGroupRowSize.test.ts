import { describe, expect, it } from "vitest";
import { estimateTimelineProjectionRowSize } from "./messagesTimelineVirtualization";
import type { TimelineProjectionRow } from "../projection/messagesTimelineProjection";
import type { ConversationItem } from "../../../../types";

function agentTool(id: string): Extract<ConversationItem, { kind: "tool" }> {
  return {
    id,
    kind: "tool",
    toolType: "agent",
    title: "Tool: Agent",
    detail: "{}",
    status: "completed",
  };
}

function subagentRow(count: number): TimelineProjectionRow {
  const items = Array.from({ length: count }, (_, index) => agentTool(`agent-${index}`));
  return {
    kind: "entry",
    key: `subagentGroup:${items[0]?.id ?? "empty"}`,
    itemIds: items.map((item) => item.id),
    entry: { kind: "subagentGroup", items },
    hasActiveUserInputAnchor: false,
  };
}

describe("estimateTimelineProjectionRowSize for subagentGroup", () => {
  it("sizes a single card taller than a flat tool row", () => {
    const size = estimateTimelineProjectionRowSize(subagentRow(1));
    expect(size).toBeGreaterThan(100);
    expect(size).toBeLessThan(220);
  });

  it("grows with more squad members", () => {
    const one = estimateTimelineProjectionRowSize(subagentRow(1));
    const seven = estimateTimelineProjectionRowSize(subagentRow(7));
    expect(seven).toBeGreaterThan(one);
    // 7 cards ≈ 3 columns × 3 rows → should exceed naive 112px group default
    expect(seven).toBeGreaterThan(300);
  });
});
