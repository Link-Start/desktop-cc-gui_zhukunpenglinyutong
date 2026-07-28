import { describe, expect, it } from "vitest";

import {
  classifyContextProtocolText,
  filterContextProtocolConversationItems,
  hasContextProtocolControlTail,
} from "./contextProtocol";

const PACKAGE = `sha256:${"a".repeat(64)}`;
const CHECKSUM = `sha256:${"b".repeat(64)}`;

describe("classifyContextProtocolText", () => {
  it("recognizes exact package and acceptance markers", () => {
    expect(
      classifyContextProtocolText(
        `MOSSX_CONTEXT_PACKAGE:${PACKAGE}:${CHECKSUM}`,
      ),
    ).toBe("context-package");
    expect(
      classifyContextProtocolText(
        `MOSSX_CONTEXT_ACCEPTED:${PACKAGE}:${CHECKSUM}`,
      ),
    ).toBe("context-accepted");
  });

  it("recognizes a complete native context prompt prefix", () => {
    expect(
      classifyContextProtocolText(
        `MOSSX_CONTEXT_PACKAGE:${PACKAGE}:${CHECKSUM}\n` +
          "MOSSX_NATIVE_CONTEXT_V1\n" +
          "source:claude:source-id\n" +
          "binding:codex:provider-id\n\n" +
          "Shared Context Transcript",
      ),
    ).toBe("native-context-prompt");
  });

  it("recognizes only a complete Shared Runtime prompt envelope", () => {
    const marker = `MOSSX_CONTEXT_PACKAGE:${PACKAGE}:${CHECKSUM}`;
    expect(
      classifyContextProtocolText(
        `${marker}\n` +
          "MOSSX_SHARED_CONTEXT_V1\n" +
          "session:shared-session-1\n" +
          "binding:codex::managed-a\n\n" +
          "Shared Context Transcript\n\nTurn 1\nUser: 你好\n" +
          `${marker}\n\n` +
          "Current user request:\n继续修复",
      ),
    ).toBe("shared-runtime-prompt");

    expect(
      classifyContextProtocolText(
        `${marker}\n` +
          "MOSSX_SHARED_CONTEXT_V1\n" +
          "session:shared-session-1\n" +
          "binding:codex::managed-a\n\n" +
          "Shared Context Transcript\n" +
          `MOSSX_CONTEXT_PACKAGE:${CHECKSUM}:${PACKAGE}\n\n` +
          "Current user request:\n继续修复",
      ),
    ).toBeNull();
  });

  it("preserves ordinary user text that merely mentions MOSSX", () => {
    expect(
      classifyContextProtocolText(
        "请解释 MOSSX_CONTEXT_PACKAGE 是什么，不要隐藏这条消息",
      ),
    ).toBeNull();
    expect(
      classifyContextProtocolText(
        "MOSSX_CONTEXT_PACKAGE:sha256:not-a-hash:sha256:not-a-hash",
      ),
    ).toBeNull();
    expect(
      classifyContextProtocolText(
        "请解释 MOSSX_SHARED_CONTEXT_V1 和 Current user request 的作用",
      ),
    ).toBeNull();
  });
});

describe("filterContextProtocolConversationItems", () => {
  it("removes the complete bootstrap exchange until the first real user turn", () => {
    const packageId = `sha256:${"a".repeat(64)}`;
    const checksum = `sha256:${"b".repeat(64)}`;
    const items = [
      {
        id: "bootstrap-user",
        kind: "message" as const,
        role: "user" as const,
        text:
          `MOSSX_CONTEXT_PACKAGE:${packageId}:${checksum}\n` +
          "MOSSX_NATIVE_CONTEXT_V1\nsource:claude:source\nbinding:continuation:op\n",
      },
      {
        id: "bootstrap-reasoning",
        kind: "reasoning" as const,
        summary: "bootstrap",
        content: "processing context",
      },
      {
        id: "bootstrap-assistant",
        kind: "message" as const,
        role: "assistant" as const,
        text: "你好，我是 Claude。",
      },
      {
        id: "real-user",
        kind: "message" as const,
        role: "user" as const,
        text: "继续修复问题",
      },
      {
        id: "real-assistant",
        kind: "message" as const,
        role: "assistant" as const,
        text: "开始处理。",
      },
    ];

    expect(filterContextProtocolConversationItems(items).map((item) => item.id)).toEqual([
      "real-user",
      "real-assistant",
    ]);
    expect(hasContextProtocolControlTail(items.slice(0, 3))).toBe(true);
    expect(hasContextProtocolControlTail(items)).toBe(false);
  });

  it("removes only a Shared Runtime user echo and keeps the assistant turn", () => {
    const marker = `MOSSX_CONTEXT_PACKAGE:${PACKAGE}:${CHECKSUM}`;
    const items = [
      {
        id: "canonical-user",
        kind: "message" as const,
        role: "user" as const,
        text: "继续修复",
      },
      {
        id: "runtime-user-echo",
        kind: "message" as const,
        role: "user" as const,
        text:
          `${marker}\n` +
          "MOSSX_SHARED_CONTEXT_V1\n" +
          "session:shared-session-1\n" +
          "binding:codex::managed-a\n\n" +
          "Shared Context Transcript\n\nTurn 1\nUser: 你好\n" +
          `${marker}\n\n` +
          "Current user request:\n继续修复",
      },
      {
        id: "runtime-reasoning",
        kind: "reasoning" as const,
        summary: "思考过程",
        content: "定位问题",
      },
      {
        id: "runtime-assistant",
        kind: "message" as const,
        role: "assistant" as const,
        text: "已经修复。",
      },
    ];

    expect(filterContextProtocolConversationItems(items).map((item) => item.id)).toEqual([
      "canonical-user",
      "runtime-reasoning",
      "runtime-assistant",
    ]);
    expect(hasContextProtocolControlTail(items.slice(0, 2))).toBe(false);
  });
});
