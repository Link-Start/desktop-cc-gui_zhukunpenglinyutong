import { describe, expect, it } from "vitest";
import {
  loadRegisteredOlderHistoryPage,
  resolveOlderHistoryDiskEngine,
  resolveOlderHistoryDiskLimit,
} from "./olderHistoryPage";

describe("olderHistoryPage registry", () => {
  it("registers Claude at 80 and DSH at 200", () => {
    expect(resolveOlderHistoryDiskEngine("claude:sess")).toBe("claude");
    expect(resolveOlderHistoryDiskLimit("claude")).toBe(80);
    expect(resolveOlderHistoryDiskEngine("dsh:sess")).toBe("dsh");
    expect(resolveOlderHistoryDiskLimit("dsh")).toBe(200);
  });

  it("leaves unregistered engines closed", () => {
    expect(resolveOlderHistoryDiskEngine("codex:thread")).toBeNull();
    expect(resolveOlderHistoryDiskEngine("grok:session")).toBeNull();
    expect(resolveOlderHistoryDiskEngine("shared:1")).toBeNull();
  });

  it("does not fall through to Claude when the engine is unregistered", async () => {
    await expect(
      loadRegisteredOlderHistoryPage({
        threadId: "codex:thread",
        workspaceId: "ws-1",
        workspacePath: "/tmp/ws",
        before: "80",
      }),
    ).resolves.toEqual({
      items: [],
      hasMore: false,
      nextCursor: null,
    });
  });
});
