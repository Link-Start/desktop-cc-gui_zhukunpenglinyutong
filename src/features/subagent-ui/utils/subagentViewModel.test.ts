import { describe, expect, it } from "vitest";
import {
  buildSubagentCardFromToolItem,
  buildSubagentCardsFromToolItems,
  resolveSubagentProgress,
} from "./subagentViewModel";
import type { ConversationItem } from "../../../types";

function makeAgentTool(
  id: string,
  overrides?: Partial<Extract<ConversationItem, { kind: "tool" }>>,
): Extract<ConversationItem, { kind: "tool" }> {
  return {
    id,
    kind: "tool",
    toolType: "agent",
    title: "Tool: Agent",
    detail: JSON.stringify({
      description: "排查 session catalog",
      subagent_type: "explore",
    }),
    status: "completed",
    output: "done report",
    ...overrides,
  };
}

describe("subagentViewModel", () => {
  it("builds a persona card from an agent tool item", () => {
    const card = buildSubagentCardFromToolItem(makeAgentTool("tool-1"));
    expect(card.id).toBe("tool-1");
    expect(card.description).toContain("session catalog");
    expect(card.status).toBe("completed");
    expect(card.progress).toBe(1);
    expect(card.displayName.length).toBeGreaterThan(0);
    expect(card.outputText).toContain("done report");
    // 作者池有 githubLogin 时带主页/头像字段
    expect("githubProfileUrl" in card).toBe(true);
    expect("avatarSrc" in card).toBe(true);
  });

  it("parses output_file path and agentId from agent launch ack text", () => {
    const card = buildSubagentCardFromToolItem(
      makeAgentTool("tool-path", {
        output:
          "Async agent launched successfully.\noutput_file: /tmp/claude/tasks/abc/agent.output\nagentId: a59c91e328c6a6c61",
      }),
      { parentThreadId: "claude:parent-session-id" },
    );
    expect(card.taskOutput?.outputFilePath).toBe(
      "/tmp/claude/tasks/abc/agent.output",
    );
    expect(card.taskOutput?.outputFileName).toBe("agent.output");
    expect(card.agentId).toBe("a59c91e328c6a6c61");
    expect(card.sessionThreadId).toBe(
      "claude:subagent:parent-session-id:a59c91e328c6a6c61",
    );
  });

  it("keeps running progress below full", () => {
    expect(resolveSubagentProgress("running", 3)).toBeLessThan(1);
    expect(resolveSubagentProgress("completed", 3)).toBe(1);
  });

  it("assigns distinct-ish names for a squad of tools", () => {
    const cards = buildSubagentCardsFromToolItems([
      makeAgentTool("a"),
      makeAgentTool("b", { status: "running", output: undefined }),
    ]);
    expect(cards).toHaveLength(2);
    expect(cards[0]?.indexLabel).toBe("01");
    expect(cards[1]?.indexLabel).toBe("02");
    expect(cards[1]?.status).toBe("running");
    expect(cards[1]?.progress).toBeLessThan(1);
  });
});
