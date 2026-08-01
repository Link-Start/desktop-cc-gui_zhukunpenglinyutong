import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../../types";
import { resolveCollapsedTimelineItems } from "./messagesViewModel";

function user(id: string, text = "你好"): ConversationItem {
  return { id, kind: "message", role: "user", text };
}

function assistant(id: string, text: string): ConversationItem {
  return { id, kind: "message", role: "assistant", text };
}

function reasoning(id: string): ConversationItem {
  return { id, kind: "reasoning", summary: "分析中", content: "thinking" };
}

function tool(
  id: string,
  status: "running" | "completed" = "completed",
  durationMs?: number,
): ConversationItem {
  return {
    id,
    kind: "tool",
    toolType: "fileRead",
    title: "Read foo.ts",
    detail: "foo.ts",
    status,
    output: "",
    durationMs,
  };
}

describe("resolveCollapsedTimelineItems causal phase collapse", () => {
  it("keeps full process visible while tools are still running before any assistant text", () => {
    const items = [user("u1"), reasoning("r1"), tool("t1", "running")];
    const result = resolveCollapsedTimelineItems({
      activeEngine: "claude",
      timelineSourceItems: items,
    });

    expect(result.phases).toEqual([]);
    expect(result.timelineItems.map((item) => item.id)).toEqual(["u1", "r1", "t1"]);
  });

  it("collapses only the process run immediately above assistant prose when count > 1", () => {
    const items = [
      user("u1"),
      reasoning("r1"),
      tool("t1", "completed", 1_000),
      assistant("a1", "最终结论"),
    ];
    const result = resolveCollapsedTimelineItems({
      activeEngine: "claude",
      timelineSourceItems: items,
    });

    // Hard-unmount: process rows leave the timeline when collapsed.
    expect(result.timelineItems.map((item) => item.id)).toEqual(["u1", "a1"]);
    expect(result.phases).toHaveLength(1);
    expect(result.phases[0]).toMatchObject({
      phaseKey: "a1",
      insertBeforeItemId: "r1",
      assistantItemId: "a1",
      expanded: false,
      durationMs: 1_000,
      breakdown: { reasoningCount: 1, toolCount: 1, exploreCount: 0 },
    });
    expect(result.phases[0]!.count).toBeGreaterThan(1);
    expect(result.phases[0]!.hiddenItemIds).toEqual(["r1", "t1"]);
  });

  it("does not collapse a single process step", () => {
    const items = [user("u1"), tool("t1"), assistant("a1", "最终结论")];
    const result = resolveCollapsedTimelineItems({
      activeEngine: "claude",
      timelineSourceItems: items,
    });
    expect(result.phases).toEqual([]);
    expect(result.timelineItems.map((item) => item.id)).toEqual(["u1", "t1", "a1"]);
  });

  it("creates a separate chip for each assistant prose phase", () => {
    const items: ConversationItem[] = [
      user("u1"),
      tool("t1"),
      assistant("a1", "第一段"),
      {
        id: "t2",
        kind: "tool",
        toolType: "fileRead",
        title: "Read a.ts",
        detail: "a.ts",
        status: "completed",
        output: "",
      },
      {
        id: "t3",
        kind: "tool",
        toolType: "toolCall",
        title: "Tool: Grep",
        detail: "pattern",
        status: "completed",
        output: "",
      },
      assistant("a2", "第二段"),
      tool("t4", "running"),
    ];
    const result = resolveCollapsedTimelineItems({
      activeEngine: "claude",
      timelineSourceItems: items,
    });

    // t1 alone above a1 is a single step → no phase; t2+t3 above a2 → collapsed phase.
    expect(result.timelineItems.map((item) => item.id)).toEqual([
      "u1",
      "t1",
      "a1",
      "a2",
      "t4",
    ]);
    expect(result.phases.map((phase) => phase.phaseKey)).toEqual(["a2"]);
    expect(result.phases[0]!.count).toBeGreaterThanOrEqual(2);
  });

  it("does not collapse when assistant message exists but text is still empty", () => {
    const items = [user("u1"), tool("t1"), assistant("a1", "   ")];
    const result = resolveCollapsedTimelineItems({
      activeEngine: "claude",
      timelineSourceItems: items,
    });

    expect(result.phases).toEqual([]);
    expect(result.timelineItems.map((item) => item.id)).toEqual(["u1", "t1", "a1"]);
  });

  it("remounts only the expanded phase process rows", () => {
    const items: ConversationItem[] = [
      user("u1"),
      reasoning("r1"),
      tool("t1"),
      assistant("a1", "最终结论"),
      reasoning("r2"),
      tool("t2"),
      assistant("a2", "下一段"),
    ];
    const result = resolveCollapsedTimelineItems({
      activeEngine: "claude",
      expandedPhaseKeys: new Set(["a1"]),
      timelineSourceItems: items,
    });

    // a1 expanded → r1/t1 remounted; a2 collapsed → r2/t2 unmounted.
    expect(result.timelineItems.map((item) => item.id)).toEqual([
      "u1",
      "r1",
      "t1",
      "a1",
      "a2",
    ]);
    expect(result.phases.find((phase) => phase.phaseKey === "a1")?.expanded).toBe(true);
    expect(result.phases.find((phase) => phase.phaseKey === "a2")?.expanded).toBe(false);
  });

  it("skips command-only phases that the canvas already hides", () => {
    const items = [
      user("u1"),
      {
        id: "cmd-1",
        kind: "tool" as const,
        toolType: "commandExecution" as const,
        title: "Command: rg --files",
        detail: "/tmp",
        status: "completed" as const,
        output: "",
      },
      assistant("a1", "最终输出"),
    ];
    const result = resolveCollapsedTimelineItems({
      activeEngine: "claude",
      timelineSourceItems: items,
    });

    // bash/command cards are not renderable on Claude canvas, so no phase chip.
    expect(result.phases).toEqual([]);
    expect(result.timelineItems.map((item) => item.id)).toEqual(["u1", "cmd-1", "a1"]);
  });
});
