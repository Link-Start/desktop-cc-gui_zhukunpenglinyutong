import { describe, expect, it } from "vitest";
import {
  extractFallbackUserMessagePayload,
  extractLatestUserInputTextPreserveFormatting,
  extractModeFallbackMode,
  extractSelectedAgentIconFromUserMessageItem,
  extractSelectedAgentNameFromUserMessageItem,
  normalizeUserMessageText,
  stripAgentPromptBlockFromTail,
  stripInjectedPrefixLines,
} from "./threadItemsUserMessage";

describe("threadItemsUserMessage", () => {
  it("normalizes injected project memory out of user text", () => {
    const text = [
      '<project-memory source="project-memory" count="1" truncated="false">',
      "[对话记录] 测试记忆",
      "</project-memory>",
      "",
      "继续拆分用户消息 helper",
    ].join("\n");

    expect(normalizeUserMessageText(text)).toBe("继续拆分用户消息 helper");
  });

  it("normalizes shared-session and mode fallback wrappers", () => {
    const sharedSessionText = [
      "Shared session context sync. Continue from these recent turns before answering the new request:",
      "",
      "Turn 1",
      "User: 之前的问题",
      "codex: 之前的回答",
      "",
      "Current user request:",
      "继续推进",
    ].join("\n");
    const modeFallbackText = [
      "Execution policy (plan mode): planning-only.",
      "",
      "User request: 只输出方案",
    ].join("\n");

    expect(normalizeUserMessageText(sharedSessionText)).toBe("继续推进");
    expect(extractModeFallbackMode(modeFallbackText)).toBe("plan");
    expect(normalizeUserMessageText(modeFallbackText)).toBe("只输出方案");
  });

  it("extracts the latest user input while preserving formatting", () => {
    const text = [
      "[System] internal",
      "[User Input] 第一轮",
      "",
      "保留换行",
      "[User Input] 第二轮",
      "1. 第一项",
      "2. 第二项",
    ].join("\n");

    expect(extractLatestUserInputTextPreserveFormatting(text)).toBe(
      "第二轮\n1. 第一项\n2. 第二项",
    );
  });

  it("strips injected title prefixes", () => {
    const text = [
      "[System] 你是 ccgui Agent。",
      "[Skill Prompt] tr-zh-en-jp",
      "[Commons Prompt] follow project rules",
      "真正的标题内容",
    ].join("\n");

    expect(stripInjectedPrefixLines(text)).toBe("真正的标题内容");
  });

  it("extracts selected agent metadata from prompt tail", () => {
    const text = [
      "请继续优化。",
      "",
      "## Agent Role and Instructions",
      "",
      "Agent Name: 后端架构师",
      "Agent Icon: agent-robot-04",
      "",
      "你是一位资深后端架构师。",
    ].join("\n");

    expect(stripAgentPromptBlockFromTail(text)).toBe("请继续优化。");
    expect(extractSelectedAgentNameFromUserMessageItem({}, text)).toBe("后端架构师");
    expect(extractSelectedAgentIconFromUserMessageItem({}, text)).toBe("agent-robot-04");
  });

  it("builds fallback user message payload from direct text and image fields", () => {
    const payload = extractFallbackUserMessagePayload({
      text: "Collaboration mode: code.\n\nUser request: 继续实现",
      images: [" /tmp/a.png ", { url: "https://example.com/b.png" }],
    });

    expect(payload).toEqual({
      text: "继续实现",
      collaborationMode: "code",
      images: ["/tmp/a.png", "https://example.com/b.png"],
    });
  });
});
