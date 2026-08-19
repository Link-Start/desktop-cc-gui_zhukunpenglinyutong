import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../../types";
import {
  buildMessageActionTargets,
  isNewTailUserMessage,
} from "./messagesViewModel";

function userMessage(id: string): ConversationItem {
  return {
    id,
    kind: "message",
    role: "user",
    text: `message ${id}`,
  };
}

function assistantMessage(id: string): ConversationItem {
  return {
    id,
    kind: "message",
    role: "assistant",
    text: `reply ${id}`,
    isFinal: true,
  };
}

describe("isNewTailUserMessage", () => {
  it("treats a new tail user id as a send", () => {
    expect(isNewTailUserMessage(null, "user-2")).toBe(true);
    expect(isNewTailUserMessage("user-1", "user-2")).toBe(true);
  });

  it("does not treat a prepend that keeps the same tail id as a send", () => {
    expect(isNewTailUserMessage("user-tail", "user-tail")).toBe(false);
  });

  it("does not treat a missing next tail as a send", () => {
    expect(isNewTailUserMessage("user-1", null)).toBe(false);
    expect(isNewTailUserMessage(null, null)).toBe(false);
  });
});

describe("buildMessageActionTargets latestUserMessageId", () => {
  it("keeps the tail user id when older user messages are prepended", () => {
    const tail = [
      userMessage("user-visible"),
      assistantMessage("assistant-visible"),
    ];
    const afterPrepend = [
      userMessage("user-older-1"),
      assistantMessage("assistant-older-1"),
      userMessage("user-older-2"),
      ...tail,
    ];

    const before = buildMessageActionTargets(tail);
    const after = buildMessageActionTargets(afterPrepend);

    expect(before.latestUserMessageId).toBe("user-visible");
    expect(after.latestUserMessageId).toBe("user-visible");
    expect(after.userMessageCount).toBeGreaterThan(before.userMessageCount);
    expect(
      isNewTailUserMessage(before.latestUserMessageId, after.latestUserMessageId),
    ).toBe(false);
  });
});
