import { describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../types";
import { loadClaudeOlderHistoryPage } from "./loadClaudeOlderHistoryPage";

function userMessage(id: string): ConversationItem {
  return {
    id,
    kind: "message",
    role: "user",
    text: `message ${id}`,
  };
}

describe("loadClaudeOlderHistoryPage", () => {
  it("passes limit and before through to loadClaudeSession", async () => {
    const loadClaudeSessionFn = vi.fn().mockResolvedValue({
      messages: [{ id: "older" }],
      hasMore: true,
      nextCursor: "40",
    });
    const parseMessagesFn = vi.fn().mockReturnValue([userMessage("older")]);

    const page = await loadClaudeOlderHistoryPage({
      threadId: "claude:sess-1",
      workspaceId: "ws-1",
      workspacePath: "/tmp/ws",
      before: "80",
      limit: 80,
      loadClaudeSessionFn,
      parseMessagesFn,
    });

    expect(loadClaudeSessionFn).toHaveBeenCalledWith("/tmp/ws", "sess-1", {
      limit: 80,
      before: "80",
    });
    expect(parseMessagesFn).toHaveBeenCalledWith({
      messagesData: [{ id: "older" }],
      workspacePath: "/tmp/ws",
      workspaceId: "ws-1",
      threadId: "claude:sess-1",
      sessionId: "sess-1",
    });
    expect(page).toEqual({
      items: [userMessage("older")],
      hasMore: true,
      nextCursor: "40",
    });
  });
});
