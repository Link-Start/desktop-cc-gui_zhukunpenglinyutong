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
});
