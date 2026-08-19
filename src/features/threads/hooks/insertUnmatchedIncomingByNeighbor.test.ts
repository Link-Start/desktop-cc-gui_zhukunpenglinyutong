import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../types";
import { insertUnmatchedIncomingByNeighbor } from "./insertUnmatchedIncomingByNeighbor";

function userMessage(id: string, text: string): ConversationItem {
  return {
    id,
    kind: "message",
    role: "user",
    text,
  };
}

function assistantMessage(id: string, text: string): ConversationItem {
  return {
    id,
    kind: "message",
    role: "assistant",
    text,
  };
}

describe("insertUnmatchedIncomingByNeighbor", () => {
  it("inserts a late older window above the unmatched optimistic tail", () => {
    const optimistic = userMessage("optimistic-user-late", "新问题");
    const ordered = [
      userMessage("hist-2", "第二问"),
      assistantMessage("a-2", "答二"),
      optimistic,
    ];
    const incoming = [
      userMessage("hist-1", "第一问"),
      assistantMessage("a-1", "答一"),
      userMessage("hist-2", "第二问"),
      assistantMessage("a-2", "答二"),
    ];
    const leftover = [incoming[0], incoming[1]] as ConversationItem[];

    const merged = insertUnmatchedIncomingByNeighbor(ordered, leftover, incoming);

    expect(merged.map((item) => item.id)).toEqual([
      "hist-1",
      "a-1",
      "hist-2",
      "a-2",
      "optimistic-user-late",
    ]);
  });

  it("inserts leftover between two already-emitted matched ids", () => {
    const ordered = [
      userMessage("matched-1", "问一"),
      userMessage("matched-2", "问二"),
      userMessage("optimistic-user-mid", "新问"),
    ];
    const incoming = [
      userMessage("matched-1", "问一"),
      assistantMessage("unmatched-x", "中间答"),
      userMessage("matched-2", "问二"),
    ];

    const merged = insertUnmatchedIncomingByNeighbor(
      ordered,
      [incoming[1] as ConversationItem],
      incoming,
    );

    expect(merged.map((item) => item.id)).toEqual([
      "matched-1",
      "unmatched-x",
      "matched-2",
      "optimistic-user-mid",
    ]);
  });

  it("appends leftover only when it is not in the incoming neighbor graph", () => {
    const ordered = [
      userMessage("matched-1", "问一"),
      userMessage("optimistic-user-end", "新问"),
    ];
    const incoming = [userMessage("matched-1", "问一")];
    const orphan = assistantMessage("orphan-not-in-incoming", "游离");

    const merged = insertUnmatchedIncomingByNeighbor(ordered, [orphan], incoming);

    expect(merged.map((item) => item.id)).toEqual([
      "matched-1",
      "optimistic-user-end",
      "orphan-not-in-incoming",
    ]);
  });

  it("places a fully unmatched older window before the local-only tail", () => {
    const optimistic = userMessage("optimistic-user-only", "刚发出去");
    const incoming = [
      userMessage("older-1", "更早问"),
      assistantMessage("older-a", "更早答"),
    ];

    const merged = insertUnmatchedIncomingByNeighbor(
      [optimistic],
      incoming,
      incoming,
    );

    expect(merged.map((item) => item.id)).toEqual([
      "older-1",
      "older-a",
      "optimistic-user-only",
    ]);
  });

  it("does not insert unmatched explore leftovers when incoming has no matched neighbor", () => {
    const optimistic = userMessage("optimistic-user-only", "在吗");
    const leftoverExplore: ConversationItem = {
      id: "foreign-explore",
      kind: "explore",
      status: "exploring",
      entries: [{ kind: "list", label: "Downloads" }],
    };
    const leftoverCommand: ConversationItem = {
      id: "foreign-ls",
      kind: "tool",
      toolType: "commandExecution",
      title: "Command: ls /Users/demo/Downloads",
      detail: "",
      status: "inProgress",
    };
    const incoming = [leftoverExplore, leftoverCommand];

    const merged = insertUnmatchedIncomingByNeighbor(
      [optimistic],
      incoming,
      incoming,
    );

    expect(merged.map((item) => item.id)).toEqual(["optimistic-user-only"]);
  });

  it("still inserts unmatched user/assistant leftovers when incoming has no matched neighbor", () => {
    const optimistic = userMessage("optimistic-user-only", "在吗");
    const leftoverExplore: ConversationItem = {
      id: "foreign-explore",
      kind: "explore",
      status: "explored",
      entries: [{ kind: "list", label: "Downloads" }],
    };
    const incoming = [
      leftoverExplore,
      userMessage("older-1", "更早问"),
      assistantMessage("older-a", "更早答"),
    ];

    const merged = insertUnmatchedIncomingByNeighbor(
      [optimistic],
      incoming,
      incoming,
    );

    expect(merged.map((item) => item.id)).toEqual([
      "older-1",
      "older-a",
      "optimistic-user-only",
    ]);
  });

  it("still inserts explore leftovers when a matched incoming neighbor exists", () => {
    const leftoverExplore: ConversationItem = {
      id: "same-session-explore",
      kind: "explore",
      status: "explored",
      entries: [{ kind: "read", label: "routes.ts" }],
    };
    const ordered = [
      userMessage("hist-2", "第二问"),
      userMessage("optimistic-user-mid", "新问"),
    ];
    const incoming = [leftoverExplore, userMessage("hist-2", "第二问")];

    const merged = insertUnmatchedIncomingByNeighbor(
      ordered,
      [leftoverExplore],
      incoming,
    );

    expect(merged.map((item) => item.id)).toEqual([
      "same-session-explore",
      "hist-2",
      "optimistic-user-mid",
    ]);
  });
});
