import { describe, expect, it } from "vitest";

import { classifyContextProtocolText } from "./contextProtocol";

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
