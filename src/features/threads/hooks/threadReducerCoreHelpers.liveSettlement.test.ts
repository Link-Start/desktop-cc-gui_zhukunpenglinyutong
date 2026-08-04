import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../types";
import {
  findAssistantMessageIndexForLiveSettlement,
  listHasAssistantSegmentSiblings,
} from "./threadReducerCoreHelpers";

function assistant(id: string, text: string): ConversationItem {
  return {
    id,
    kind: "message",
    role: "assistant",
    text,
  };
}

function tool(id: string): ConversationItem {
  return {
    id,
    kind: "tool",
    toolType: "mcpToolCall",
    title: "Search",
    detail: "",
    status: "completed",
  };
}

describe("findAssistantMessageIndexForLiveSettlement", () => {
  it("prefers latest -seg-* sibling when segment reset collapses to bare base id", () => {
    const list: ConversationItem[] = [
      assistant("agent-1", "先看代码。"),
      tool("tool-1"),
      assistant("agent-1-seg-1", "建壳"),
    ];
    // After resetAgentSegment, resolveLiveAssistantMessageId → bare agent-1
    const index = findAssistantMessageIndexForLiveSettlement(
      list,
      "agent-1",
      "agent-1",
    );
    expect(index).toBe(2);
    expect((list[index] as { id: string }).id).toBe("agent-1-seg-1");
  });

  it("keeps bare base when no segmented siblings exist", () => {
    const list: ConversationItem[] = [assistant("agent-1", "只有一段")];
    const index = findAssistantMessageIndexForLiveSettlement(
      list,
      "agent-1",
      "agent-1",
    );
    expect(index).toBe(0);
  });

  it("hits exact current-segment id when segment counter still elevated", () => {
    const list: ConversationItem[] = [
      assistant("agent-1", "开场"),
      tool("tool-1"),
      assistant("agent-1-seg-1", "中段"),
      tool("tool-2"),
      assistant("agent-1-seg-2", "结论壳"),
    ];
    const index = findAssistantMessageIndexForLiveSettlement(
      list,
      "agent-1",
      "agent-1-seg-2",
    );
    expect(index).toBe(4);
  });

  it("complete falls back to latest segmented sibling when exact resolved id missing", () => {
    const list: ConversationItem[] = [
      assistant("agent-1", "开场"),
      tool("tool-1"),
      assistant("agent-1-seg-1", "结论壳"),
    ];
    // Stale resolve pointing at non-existent seg-9
    const index = findAssistantMessageIndexForLiveSettlement(
      list,
      "agent-1",
      "agent-1-seg-9",
      "complete",
    );
    expect(index).toBe(2);
  });

  it("append returns -1 for missing -seg-N so a new post-tool shell can be created", () => {
    const list: ConversationItem[] = [
      assistant("agent-1", "开场"),
      tool("tool-1"),
    ];
    const index = findAssistantMessageIndexForLiveSettlement(
      list,
      "agent-1",
      "agent-1-seg-1",
      "append",
    );
    expect(index).toBe(-1);
  });

  it("listHasAssistantSegmentSiblings detects -seg- prefix only", () => {
    expect(
      listHasAssistantSegmentSiblings(
        [assistant("agent-1", "a"), assistant("agent-1-seg-1", "b")],
        "agent-1",
      ),
    ).toBe(true);
    expect(
      listHasAssistantSegmentSiblings([assistant("agent-1", "a")], "agent-1"),
    ).toBe(false);
    expect(
      listHasAssistantSegmentSiblings(
        [assistant("agent-1-extra", "a")],
        "agent-1",
      ),
    ).toBe(false);
  });
});
