import { describe, expect, it } from "vitest";
import {
  isCollabLifecycleTool,
  isCollabSpawnTool,
  isSubagentTool,
} from "./isSubagentTool";

describe("isSubagentTool cross-engine", () => {
  it("matches Claude Agent / Task", () => {
    expect(isSubagentTool({ toolType: "agent", title: "Tool: Agent" })).toBe(true);
    expect(isSubagentTool({ toolType: "task", title: "Tool: Task" })).toBe(true);
  });

  it("matches Codex collab spawn but not wait/close", () => {
    expect(
      isSubagentTool({ toolType: "collabToolCall", title: "Collab: spawn Agent" }),
    ).toBe(true);
    expect(isCollabSpawnTool({ toolType: "collabToolCall", title: "Collab: spawn Agent" })).toBe(
      true,
    );
    expect(
      isSubagentTool({ toolType: "collabToolCall", title: "Collab: wait Agent" }),
    ).toBe(false);
    expect(
      isCollabLifecycleTool({ toolType: "collabToolCall", title: "Collab: close Agent" }),
    ).toBe(true);
  });

  it("matches Grok Subagent N titles", () => {
    expect(
      isSubagentTool({ toolType: "mcpToolCall", title: "Subagent 1 问候测试" }),
    ).toBe(true);
    expect(
      isSubagentTool({ toolType: "tool", title: "Subagent 2 问候测试" }),
    ).toBe(true);
  });

  it("matches Kimi agent swarm titles", () => {
    expect(
      isSubagentTool({
        toolType: "tool",
        title: "Launching agent swarm: 3个子代理问候测试",
      }),
    ).toBe(true);
  });

  it("rejects ordinary tools", () => {
    expect(isSubagentTool({ toolType: "commandExecution", title: "Bash" })).toBe(false);
    expect(isSubagentTool({ toolType: "read", title: "Tool: Read" })).toBe(false);
  });
});
