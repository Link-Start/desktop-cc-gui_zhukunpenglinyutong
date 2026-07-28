import { describe, expect, it } from "vitest";
import { parseGrokHistoryMessages } from "./grokHistoryParser";

describe("parseGrokHistoryMessages", () => {
  it("returns empty items for non-array payloads", () => {
    expect(parseGrokHistoryMessages(null)).toEqual([]);
    expect(parseGrokHistoryMessages({ messages: [] })).toEqual([]);
  });

  it("maps user and assistant messages to conversation items", () => {
    const items = parseGrokHistoryMessages([
      {
        id: "grok-user-1",
        kind: "message",
        role: "user",
        text: "hello",
        images: ["/tmp/demo.png"],
      },
      {
        id: "grok-assistant-1",
        kind: "message",
        role: "assistant",
        text: "hi",
      },
    ]);

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual(
      expect.objectContaining({
        id: "grok-user-1",
        kind: "message",
        role: "user",
        text: "hello",
        images: ["/tmp/demo.png"],
      }),
    );
    expect(items[1]).toEqual(
      expect.objectContaining({
        id: "grok-assistant-1",
        kind: "message",
        role: "assistant",
        text: "hi",
        isFinal: true,
      }),
    );
  });

  it("maps reasoning rows and merges adjacent reasoning text", () => {
    const items = parseGrokHistoryMessages([
      {
        id: "grok-user-1",
        kind: "message",
        role: "user",
        text: "question",
      },
      {
        id: "grok-reasoning-1",
        kind: "reasoning",
        role: "assistant",
        text: "first thought",
      },
      {
        id: "grok-reasoning-2",
        kind: "reasoning",
        role: "assistant",
        text: "second thought",
      },
    ]);

    expect(items).toHaveLength(2);
    expect(items[1]).toEqual(
      expect.objectContaining({
        kind: "reasoning",
        content: "first thought\n\nsecond thought",
      }),
    );
  });

  it("attaches tool result rows to the matching tool call", () => {
    const items = parseGrokHistoryMessages([
      {
        id: "grok-tool-1",
        kind: "tool",
        role: "assistant",
        toolType: "write_file",
        title: "write_file",
        toolInput: {
          path: "src/a.ts",
          content: "const a = 1;",
        },
      },
      {
        id: "grok-tool-1-result",
        kind: "tool",
        role: "assistant",
        toolType: "result",
        title: "Result",
        text: "done",
        toolOutput: {
          ok: true,
        },
      },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual(
      expect.objectContaining({
        id: "grok-tool-1",
        kind: "tool",
        toolType: "fileChange",
        status: "completed",
        output: "done",
      }),
    );
  });

  it("marks error tool results as failed on the source tool call", () => {
    const items = parseGrokHistoryMessages([
      {
        id: "grok-tool-2",
        kind: "tool",
        role: "assistant",
        toolType: "Grep",
        title: "Grep",
        toolInput: {
          pattern: "foo",
        },
      },
      {
        id: "grok-tool-2-result",
        kind: "tool",
        role: "assistant",
        toolType: "error",
        title: "Error",
        toolOutput: {
          error: "permission denied",
        },
      },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual(
      expect.objectContaining({
        id: "grok-tool-2",
        kind: "tool",
        status: "failed",
        output: "permission denied",
      }),
    );
  });

  it("hydrates final completion time and duration from message timestamps", () => {
    const startedAt = "2026-04-01T09:00:00.000Z";
    const completedAt = "2026-04-01T09:00:12.000Z";
    const items = parseGrokHistoryMessages([
      {
        id: "grok-user-timing-1",
        kind: "message",
        role: "user",
        text: "hello",
        timestamp: startedAt,
      },
      {
        id: "grok-assistant-timing-1",
        kind: "message",
        role: "assistant",
        text: "done",
        timestamp: completedAt,
      },
    ]);

    const assistant = items.find(
      (item) => item.kind === "message" && item.role === "assistant",
    );
    expect(assistant).toEqual(
      expect.objectContaining({
        isFinal: true,
        finalCompletedAt: Date.parse(completedAt),
        finalDurationMs: 12_000,
      }),
    );
  });
});
