import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../types";
import { mergeThreadItemsPreservingOptimisticUsers } from "./threadReducerOptimisticItemMerge";

type UserMessage = Extract<ConversationItem, { kind: "message" }> & { role: "user" };

function userMessage(id: string, text: string): UserMessage {
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

describe("mergeThreadItemsPreservingOptimisticUsers leftover order", () => {
  it("does not append a late older disk tail after the newest optimistic user", () => {
    const local: ConversationItem[] = [
      userMessage("hist-2", "第二问"),
      assistantMessage("a-2", "答二"),
      userMessage("optimistic-user-late", "新问题"),
    ];
    const incoming: ConversationItem[] = [
      userMessage("hist-1", "第一问"),
      assistantMessage("a-1", "答一"),
      userMessage("hist-2", "第二问"),
      assistantMessage("a-2", "答二"),
    ];

    const merged = mergeThreadItemsPreservingOptimisticUsers(local, incoming, {
      isProcessing: true,
    });

    expect(merged.map((item) => item.id)).toEqual([
      "hist-1",
      "a-1",
      "hist-2",
      "a-2",
      "optimistic-user-late",
    ]);
  });

  it("keeps an unmatched optimistic user in place and does not copy a different incoming user to the end", () => {
    const local: ConversationItem[] = [
      userMessage("hist-keep", "已有提问"),
      userMessage("optimistic-user-keep", "hello"),
    ];
    const incoming: ConversationItem[] = [
      userMessage("hist-keep", "已有提问"),
      userMessage("1:user", "hello world"),
    ];

    const merged = mergeThreadItemsPreservingOptimisticUsers(local, incoming, {
      isProcessing: true,
    });
    const users = merged.filter(
      (item): item is UserMessage =>
        item.kind === "message" && item.role === "user",
    );

    expect(users.map((item) => item.id)).toEqual([
      "hist-keep",
      "1:user",
      "optimistic-user-keep",
    ]);
    expect(users.filter((item) => item.text === "hello world")).toHaveLength(1);
    expect(users[users.length - 1]?.id).toBe("optimistic-user-keep");
  });
});
