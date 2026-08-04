import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../types";
import {
  enrichSubagentCardsFromTaskNotifications,
  matchToolItemToNotificationToolUseId,
  mergeConversationItemSources,
} from "./enrichSubagentCardsFromTaskNotifications";
import type { SubagentCardViewModel } from "./subagentViewModel";

function card(partial: Partial<SubagentCardViewModel> & { id: string }): SubagentCardViewModel {
  return {
    id: partial.id,
    displayName: "Subagent",
    indexLabel: "#1",
    description: partial.description ?? "scan",
    typeLabel: partial.typeLabel ?? "explore",
    status: partial.status ?? "running",
    progress: partial.progress ?? 0.2,
    toolCount: null,
    outputText: partial.outputText ?? "Async agent launched successfully\nagentId: abc",
    taskOutput: partial.taskOutput ?? {
      id: partial.id,
      engine: "claude",
      title: "explore",
      description: "scan",
      status: "running",
      taskId: null,
      toolUseId: partial.id,
      threadId: null,
      outputFilePath: null,
      outputFileName: null,
      recentOutput: null,
    },
    githubLogin: null,
    githubProfileUrl: null,
    avatarSrc: null,
    agentId: partial.agentId ?? "abc",
    sessionThreadId: partial.sessionThreadId ?? null,
  };
}

describe("matchToolItemToNotificationToolUseId", () => {
  it("matches exact and safe suffix ids", () => {
    expect(matchToolItemToNotificationToolUseId("call-9", null, "call-9")).toBe(true);
    expect(
      matchToolItemToNotificationToolUseId("tool:call-9", null, "call-9"),
    ).toBe(true);
  });

  it("does not match prefix collisions like call_1 vs call_12", () => {
    expect(matchToolItemToNotificationToolUseId("call_1", null, "call_12")).toBe(false);
    expect(matchToolItemToNotificationToolUseId("call_12", null, "call_1")).toBe(false);
  });

  it("matches structured detail occurrence", () => {
    expect(
      matchToolItemToNotificationToolUseId(
        "other",
        '{"tool_use_id":"call-9"}',
        "call-9",
      ),
    ).toBe(true);
  });
});

describe("mergeConversationItemSources", () => {
  it("unions sources and de-dupes by id", () => {
    const a: ConversationItem[] = [
      { id: "1", kind: "message", role: "assistant", text: "a" },
    ];
    const b: ConversationItem[] = [
      { id: "1", kind: "message", role: "assistant", text: "dup" },
      { id: "2", kind: "message", role: "assistant", text: "b" },
    ];
    const merged = mergeConversationItemSources(a, b, null);
    expect(merged.map((item) => item.id)).toEqual(["1", "2"]);
  });
});

describe("enrichSubagentCardsFromTaskNotifications", () => {
  it("upgrades status and result from matching notification", () => {
    const tools: Extract<ConversationItem, { kind: "tool" }>[] = [
      {
        id: "call-9",
        kind: "tool",
        toolType: "agent",
        title: "Agent",
        detail: '{"description":"scan"}',
        status: "started",
      },
    ];
    const items: ConversationItem[] = [
      ...tools,
      {
        id: "msg-1",
        kind: "message",
        role: "assistant",
        text: `<task-notification>
<task-id>task-42</task-id>
<tool-use-id>call-9</tool-use-id>
<output-file>/tmp/task-42.output</output-file>
<status>completed</status>
<summary>Agent "scan" completed</summary>
<result>架构扫描完成</result>
</task-notification>`,
      },
    ];

    const enriched = enrichSubagentCardsFromTaskNotifications(
      [card({ id: "call-9" })],
      items,
      tools,
    );

    expect(enriched[0]?.status).toBe("completed");
    expect(enriched[0]?.outputText).toContain("架构扫描完成");
    expect(enriched[0]?.taskOutput?.taskId).toBe("task-42");
    expect(enriched[0]?.taskOutput?.outputFilePath).toBe("/tmp/task-42.output");
  });

  it("does not cross-wire call_1 and call_12", () => {
    const tools: Extract<ConversationItem, { kind: "tool" }>[] = [
      {
        id: "call_1",
        kind: "tool",
        toolType: "agent",
        title: "Agent",
        detail: "{}",
        status: "started",
      },
      {
        id: "call_12",
        kind: "tool",
        toolType: "agent",
        title: "Agent",
        detail: "{}",
        status: "started",
      },
    ];
    const items: ConversationItem[] = [
      {
        id: "msg",
        kind: "message",
        role: "assistant",
        text: `<task-notification>
<task-id>t12</task-id>
<tool-use-id>call_12</tool-use-id>
<status>completed</status>
<summary>Agent "B" completed</summary>
<result>only-b</result>
</task-notification>`,
      },
    ];
    const enriched = enrichSubagentCardsFromTaskNotifications(
      [card({ id: "call_1", description: "A" }), card({ id: "call_12", description: "B" })],
      items,
      tools,
    );
    expect(enriched[0]?.status).toBe("running");
    expect(enriched[0]?.outputText).not.toContain("only-b");
    expect(enriched[1]?.status).toBe("completed");
    expect(enriched[1]?.outputText).toContain("only-b");
  });

  it("falls back to the only card when notification has no toolUseId", () => {
    const items: ConversationItem[] = [
      {
        id: "msg",
        kind: "message",
        role: "assistant",
        text: `<task-notification>
<task-id>t-empty</task-id>
<status>completed</status>
<summary>Agent "scan" completed</summary>
<result>orphan-result</result>
</task-notification>`,
      },
    ];
    const enriched = enrichSubagentCardsFromTaskNotifications(
      [card({ id: "solo-card" })],
      items,
      [],
    );
    expect(enriched[0]?.status).toBe("completed");
    expect(enriched[0]?.outputText).toContain("orphan-result");
  });

  it("matches by description when toolUseId differs from card id", () => {
    const items: ConversationItem[] = [
      {
        id: "msg",
        kind: "message",
        role: "assistant",
        text: `<task-notification>
<task-id>t1</task-id>
<tool-use-id>tool_call_function_xyz</tool-use-id>
<status>completed</status>
<summary>Agent "项目结构与架构扫描" completed</summary>
<result>report</result>
</task-notification>`,
      },
    ];
    const enriched = enrichSubagentCardsFromTaskNotifications(
      [
        card({
          id: "synthetic-1",
          description: "项目结构与架构扫描",
          taskOutput: {
            id: "synthetic-1",
            engine: "claude",
            title: "explore",
            description: "项目结构与架构扫描",
            status: "running",
            taskId: null,
            toolUseId: "synthetic-1",
            threadId: null,
            outputFilePath: null,
            outputFileName: null,
            recentOutput: null,
          },
        }),
      ],
      items,
      [],
    );
    expect(enriched[0]?.status).toBe("completed");
    expect(enriched[0]?.outputText).toContain("report");
  });

  it("leaves cards unchanged without any match among multi cards", () => {
    const before = card({ id: "other-tool", description: "A" });
    const items: ConversationItem[] = [
      {
        id: "msg-1",
        kind: "message",
        role: "assistant",
        text: `<task-notification>
<task-id>task-42</task-id>
<tool-use-id>call-9</tool-use-id>
<status>completed</status>
<summary>Agent "scan" completed</summary>
<result>done</result>
</task-notification>`,
      },
    ];
    const enriched = enrichSubagentCardsFromTaskNotifications(
      [before, card({ id: "other-2", description: "B" })],
      items,
      [],
    );
    expect(enriched[0]?.status).toBe("running");
    expect(enriched[0]?.outputText).toBe(before.outputText);
  });
});
