import { describe, expect, it } from "vitest";
import { parseDshHistoryMessages } from "./dshHistoryParser";

describe("parseDshHistoryMessages", () => {
  it("returns empty items for non-array payloads", () => {
    expect(parseDshHistoryMessages(null)).toEqual([]);
    expect(parseDshHistoryMessages({ messages: [] })).toEqual([]);
  });

  it("maps user and assistant messages to conversation items", () => {
    const items = parseDshHistoryMessages([
      {
        id: "dsh-user-1",
        kind: "message",
        role: "user",
        text: "hello",
      },
      {
        id: "dsh-assistant-1",
        kind: "message",
        role: "assistant",
        text: "hi",
      },
    ]);

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual(
      expect.objectContaining({
        id: "dsh-user-1",
        kind: "message",
        role: "user",
        text: "hello",
      }),
    );
    expect(items[1]).toEqual(
      expect.objectContaining({
        id: "dsh-assistant-1",
        kind: "message",
        role: "assistant",
        text: "hi",
      }),
    );
  });

  it("maps reasoning rows and merges adjacent reasoning text", () => {
    const items = parseDshHistoryMessages([
      {
        id: "dsh-user-1",
        kind: "message",
        role: "user",
        text: "question",
      },
      {
        id: "dsh-reasoning-1",
        kind: "reasoning",
        text: "first thought",
      },
      {
        id: "dsh-reasoning-2",
        kind: "reasoning",
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

  it("marks tools without output as in progress", () => {
    const items = parseDshHistoryMessages([
      {
        id: "dsh-tool-open",
        kind: "tool",
        title: "Read",
        toolInput: { path: "a.ts" },
      },
    ]);
    expect(items[0]).toEqual(
      expect.objectContaining({
        kind: "tool",
        status: "in_progress",
      }),
    );
  });

  it("attaches later tool output to the matching tool call", () => {
    const items = parseDshHistoryMessages([
      {
        id: "dsh-tool-1",
        kind: "tool",
        title: "Grep",
        toolInput: { pattern: "foo" },
      },
      {
        id: "dsh-tool-1",
        kind: "tool",
        title: "Grep",
        toolOutput: "3 matches",
      },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual(
      expect.objectContaining({
        kind: "tool",
        title: "Grep",
        status: "completed",
        output: "3 matches",
      }),
    );
  });

  it("skips blank messages and unknown kinds", () => {
    const items = parseDshHistoryMessages([
      { id: "blank", kind: "message", role: "assistant", text: "   " },
      { id: "unknown", kind: "usage", text: "ignored" },
    ]);
    expect(items).toEqual([]);
  });

  it("skips DSH injected instruction, snapshot, and skill catalog messages", () => {
    const items = parseDshHistoryMessages([
      {
        id: "dsh-user-1",
        kind: "message",
        role: "user",
        text: "你好",
        source: { kind: "user" },
      },
      {
        id: "dsh-instructions",
        kind: "message",
        role: "user",
        text: "<system-reminder>\nInstructions from: AGENTS.md\n</system-reminder>",
        source: { kind: "agent-instructions", form: "instructions" },
      },
      {
        id: "dsh-snapshot",
        kind: "message",
        role: "user",
        text: "Current runtime context. This snapshot supersedes earlier runtime-context snapshots.\n\nCurrent DSH file policy: workspace-write.",
        source: { kind: "plugin", plugin: "dsh-system-prompt", form: "snapshot" },
      },
      {
        id: "dsh-skills",
        kind: "message",
        role: "user",
        text: "<system-reminder>\n<available_skills>\n- deploy-to-vercel\n</available_skills>\n</system-reminder>",
        source: { kind: "plugin", plugin: "dsh-tool-skill", form: "catalog" },
      },
      {
        id: "dsh-assistant-1",
        kind: "message",
        role: "assistant",
        text: "你好，需要我做什么？",
      },
    ]);

    expect(items.map((item) => item.id)).toEqual(["dsh-user-1", "dsh-assistant-1"]);
  });

  it("skips sourceless runtime-context text and camelCase sourceKind from fold", () => {
    const items = parseDshHistoryMessages([
      {
        id: "dsh-user-1",
        kind: "message",
        role: "user",
        text: "你好",
        sourceKind: "user",
      },
      {
        id: "dsh-snapshot",
        kind: "message",
        role: "user",
        text: "Current runtime context. This snapshot supersedes earlier runtime-context snapshots.",
      },
      {
        id: "dsh-plugin",
        kind: "message",
        role: "user",
        text: "skill catalog leftover",
        sourceKind: "plugin",
      },
    ]);
    expect(items.map((item) => item.id)).toEqual(["dsh-user-1"]);
  });

  it("keeps a real user prompt that mentions system-reminder", () => {
    const items = parseDshHistoryMessages([
      {
        id: "dsh-user-ask",
        kind: "message",
        role: "user",
        text: "what is a <system-reminder>?",
        source: { kind: "user" },
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual(
      expect.objectContaining({
        id: "dsh-user-ask",
        role: "user",
      }),
    );
  });
});
