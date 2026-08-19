import { describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../types";
import { loadDshOlderHistoryPage } from "./loadDshOlderHistoryPage";

function userMessage(id: string): ConversationItem {
  return {
    id,
    kind: "message",
    role: "user",
    text: `message ${id}`,
  };
}

describe("loadDshOlderHistoryPage", () => {
  it("passes limit and before through to loadDshSession", async () => {
    const loadDshSessionFn = vi.fn().mockResolvedValue({
      messages: [{ id: "older" }],
      hasMore: true,
      nextCursor: "161682",
    });
    const parseMessagesFn = vi.fn().mockReturnValue([userMessage("older")]);

    const page = await loadDshOlderHistoryPage({
      threadId: "dsh:sess-1",
      workspaceId: "ws-1",
      workspacePath: "/tmp/ws",
      before: "161882",
      limit: 200,
      loadDshSessionFn,
      parseMessagesFn,
    });

    expect(loadDshSessionFn).toHaveBeenCalledWith("/tmp/ws", "sess-1", {
      limit: 200,
      before: "161882",
    });
    expect(parseMessagesFn).toHaveBeenCalledWith([{ id: "older" }]);
    expect(page).toEqual({
      items: [userMessage("older")],
      hasMore: true,
      nextCursor: "161682",
    });
  });
});
