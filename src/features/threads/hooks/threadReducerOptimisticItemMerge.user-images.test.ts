import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../types";
import { mergeThreadItemsPreservingOptimisticUsers } from "./threadReducerOptimisticItemMerge";

type UserMessage = Extract<ConversationItem, { kind: "message" }> & { role: "user" };

function userMessage(
  id: string,
  text: string,
  images?: string[],
): UserMessage {
  return {
    id,
    kind: "message",
    role: "user",
    text,
    ...(images && images.length > 0 ? { images } : {}),
  };
}

describe("mergeThreadItemsPreservingOptimisticUsers user images", () => {
  it("converges text-matched optimistic+real and keeps images when projection drops them", () => {
    const local: ConversationItem[] = [
      userMessage("optimistic-user-1", "看图说明一下", ["/tmp/a.png"]),
    ];
    const incoming: ConversationItem[] = [
      userMessage("1:user", "看图说明一下"),
    ];

    const merged = mergeThreadItemsPreservingOptimisticUsers(local, incoming, {
      isProcessing: true,
    });
    const users = merged.filter(
      (item): item is UserMessage =>
        item.kind === "message" && item.role === "user",
    );

    expect(users).toHaveLength(1);
    expect(users[0]?.id).toBe("1:user");
    expect(users[0]?.images).toEqual(["/tmp/a.png"]);
  });

  it("drops optimistic when projected real already carries the same images", () => {
    const local: ConversationItem[] = [
      userMessage("optimistic-user-2", "hello", ["/tmp/a.png"]),
    ];
    const incoming: ConversationItem[] = [
      userMessage("2:user", "hello", ["/tmp/a.png"]),
    ];

    const merged = mergeThreadItemsPreservingOptimisticUsers(local, incoming, {
      isProcessing: false,
    });
    const users = merged.filter(
      (item): item is UserMessage =>
        item.kind === "message" && item.role === "user",
    );

    expect(users).toHaveLength(1);
    expect(users[0]?.id).toBe("2:user");
    expect(users[0]?.images).toEqual(["/tmp/a.png"]);
  });
});
