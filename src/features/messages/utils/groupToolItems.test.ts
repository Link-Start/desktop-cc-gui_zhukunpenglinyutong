import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../types";
import { groupToolItems } from "./groupToolItems";

function createToolItem(
  id: string,
  title: string,
  toolType: Extract<ConversationItem, { kind: "tool" }>["toolType"] = "toolCall",
): Extract<ConversationItem, { kind: "tool" }> {
  return {
    id,
    kind: "tool",
    toolType,
    title,
    detail: "{}",
    status: "completed",
  };
}

describe("groupToolItems", () => {
  it("groups consecutive edit tools only", () => {
    const entries = groupToolItems([
      createToolItem("tool-1", "Tool: edit"),
      createToolItem("tool-2", "Tool: write_to_file"),
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.kind).toBe("editGroup");
  });

  it("does not treat TodoWrite as edit tool", () => {
    const entries = groupToolItems([
      createToolItem("tool-1", "Tool: edit"),
      createToolItem("tool-2", "Tool: TodoWrite"),
    ]);

    // TodoWrite is hidden by shouldHideToolItem, so only the edit item remains as editGroup
    expect(entries).toHaveLength(1);
    expect(entries[0]?.kind).toBe("editGroup");
  });

  it("promotes a single edit tool into an editGroup scene", () => {
    const entries = groupToolItems([createToolItem("tool-1", "Tool: edit")]);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.kind).toBe("editGroup");
    if (entries[0]?.kind === "editGroup") {
      expect(entries[0].items).toHaveLength(1);
      expect(entries[0].items[0]?.id).toBe("tool-1");
    }
  });

  it("groups Grok-style flat tool names into read/search/bash/edit scenes", () => {
    const entries = groupToolItems([
      createToolItem("r1", "read_file"),
      createToolItem("r2", "list_dir"),
      createToolItem("g1", "grep"),
      createToolItem("g2", "grep"),
      createToolItem("b1", "run_terminal_command"),
      createToolItem("b2", "run_terminal_command"),
      createToolItem("e1", "search_replace"),
    ]);

    expect(entries.map((entry) => entry.kind)).toEqual([
      "readGroup",
      "searchGroup",
      "bashGroup",
      "editGroup",
    ]);
    if (entries[0]?.kind === "readGroup") {
      expect(entries[0].items.map((item) => item.id)).toEqual(["r1", "r2"]);
    }
    if (entries[3]?.kind === "editGroup") {
      expect(entries[3].items).toHaveLength(1);
      expect(entries[3].items[0]?.title).toBe("search_replace");
    }
  });

  it("merges consecutive edit and fileChange tools into one file-edit scene", () => {
    const entries = groupToolItems([
      createToolItem("tool-1", "Tool: edit"),
      createToolItem("tool-2", "File changes", "fileChange"),
      createToolItem("tool-3", "Tool: edit"),
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.kind).toBe("editGroup");
    if (entries[0]?.kind === "editGroup") {
      expect(entries[0].items.map((item) => item.id)).toEqual([
        "tool-1",
        "tool-2",
        "tool-3",
      ]);
    }
  });

  it("merges consecutive single-file fileChange tools into one editGroup", () => {
    const entries = groupToolItems([
      createToolItem("fc-1", "File changes", "fileChange"),
      createToolItem("fc-2", "File changes", "fileChange"),
      createToolItem("fc-3", "File changes", "fileChange"),
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.kind).toBe("editGroup");
    if (entries[0]?.kind === "editGroup") {
      expect(entries[0].items).toHaveLength(3);
    }
  });

  it("splits file-edit scenes when explore interrupts", () => {
    const explore: Extract<ConversationItem, { kind: "explore" }> = {
      id: "explore-1",
      kind: "explore",
      status: "explored",
      entries: [{ kind: "search", label: "foo" }],
    };
    const entries = groupToolItems([
      createToolItem("fc-1", "File changes", "fileChange"),
      explore,
      createToolItem("fc-2", "File changes", "fileChange"),
    ]);

    expect(entries).toHaveLength(3);
    expect(entries[0]?.kind).toBe("editGroup");
    expect(entries[1]?.kind).toBe("item");
    expect(entries[2]?.kind).toBe("editGroup");
  });

  it("hides TodoWrite tool blocks in message stream", () => {
    const entries = groupToolItems([
      createToolItem("tool-1", "Tool: read"),
      createToolItem("tool-2", "Tool: TodoWrite"),
      createToolItem("tool-3", "Tool: todo_write"),
      createToolItem("tool-4", "Tool: edit"),
    ]);

    expect(entries).toHaveLength(2);
    expect(entries[0]?.kind).toBe("item");
    expect(entries[1]?.kind).toBe("editGroup");
    if (entries[0]?.kind === "item" && entries[0].item.kind === "tool") {
      expect(entries[0].item.title).toBe("Tool: read");
    }
    if (entries[1]?.kind === "editGroup") {
      expect(entries[1].items[0]?.title).toBe("Tool: edit");
    }
  });

  it("keeps consecutive codex search_query mcp tools as individual items", () => {
    const entries = groupToolItems([
      createToolItem("tool-1", "Tool: search_query", "mcpToolCall"),
      createToolItem("tool-2", "Tool: search_query", "mcpToolCall"),
      createToolItem("tool-3", "Tool: search_query", "mcpToolCall"),
    ]);

    expect(entries).toHaveLength(3);
    expect(entries.every((entry) => entry.kind === "item")).toBe(true);
  });

  it("still groups regular grep-like search tools", () => {
    const entries = groupToolItems([
      createToolItem("tool-1", "Tool: grep"),
      createToolItem("tool-2", "Tool: grep"),
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.kind).toBe("searchGroup");
  });

  it("promotes a single Agent tool into a subagentGroup", () => {
    const entries = groupToolItems([createToolItem("agent-1", "Tool: Agent", "agent")]);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.kind).toBe("subagentGroup");
    if (entries[0]?.kind === "subagentGroup") {
      expect(entries[0].items).toHaveLength(1);
      expect(entries[0].items[0]?.id).toBe("agent-1");
    }
  });

  it("groups consecutive Agent tools into one subagentGroup", () => {
    const entries = groupToolItems([
      createToolItem("agent-1", "Tool: Agent", "agent"),
      createToolItem("agent-2", "Tool: Agent", "agent"),
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.kind).toBe("subagentGroup");
    if (entries[0]?.kind === "subagentGroup") {
      expect(entries[0].items).toHaveLength(2);
    }
  });

  it("breaks subagentGroup when a non-agent tool interrupts", () => {
    const entries = groupToolItems([
      createToolItem("agent-1", "Tool: Agent", "agent"),
      createToolItem("read-1", "Tool: read"),
      createToolItem("agent-2", "Tool: Agent", "agent"),
    ]);
    // 单个 read 不足以形成 readGroup，仍以 item 打断 subagent 连续段
    expect(entries.map((entry) => entry.kind)).toEqual([
      "subagentGroup",
      "item",
      "subagentGroup",
    ]);
  });
});
