// @vitest-environment jsdom
/**
 * Shared DataSource 单元测试（Wave 3 / A3，任务 5.4）。
 *
 * 验证：映射规则、flag 隔离（默认关闭）、不污染 Native 路径。
 */

import { afterEach, describe, expect, it } from "vitest";

import {
  isSharedProjectionDataSourceEnabled,
  resolveSharedConversationItems,
  toSharedConversationItems,
} from "./dataSource";
import type { SharedProjectionItem } from "./types";

function makeItem(
  overrides: Partial<SharedProjectionItem> & { kind: SharedProjectionItem["kind"] },
): SharedProjectionItem {
  return {
    id: "1:test",
    content: {},
    fidelity: "canonical",
    checksum: "x",
    ...overrides,
  };
}

afterEach(() => {
  window.localStorage.clear();
});

describe("toSharedConversationItems", () => {
  it("maps message / reasoning / tool items to ConversationItem", () => {
    const items: SharedProjectionItem[] = [
      makeItem({
        id: "1:user",
        kind: "message",
        content: { role: "user", text: "hi", turnId: "turn-1", engineSource: "claude" },
      }),
      makeItem({
        id: "2:assistant:0",
        kind: "message",
        content: {
          role: "assistant",
          text: "hello",
          turnId: "turn-1",
          engineSource: "claude",
          isFinal: true,
          finalCompletedAt: 123,
        },
      }),
      makeItem({
        id: "2:reasoning:1",
        kind: "reasoning",
        content: { summary: "thinking", content: "thinking", engineSource: "claude" },
      }),
      makeItem({
        id: "2:tool:0",
        kind: "tool",
        content: {
          toolType: "Bash",
          turnId: "turn-1",
          title: "Bash",
          detail: "ls",
          status: "completed",
          output: "ok",
          engineSource: "claude",
        },
      }),
    ];

    const result = toSharedConversationItems(items);
    expect(result).toHaveLength(4);

    expect(result[0]).toMatchObject({
      id: "1:user",
      kind: "message",
      role: "user",
      text: "hi",
      turnId: "turn-1",
      engineSource: "claude",
    });
    expect(result[1]).toMatchObject({
      kind: "message",
      role: "assistant",
      isFinal: true,
      finalCompletedAt: 123,
    });
    expect(result[2]).toMatchObject({ kind: "reasoning", summary: "thinking" });
    expect(result[3]).toMatchObject({
      kind: "tool",
      toolType: "Bash",
      status: "completed",
      output: "ok",
    });
  });

  it("drops systemNotice and metadata items (shadow 观测面不属于渲染面)", () => {
    const items: SharedProjectionItem[] = [
      makeItem({ id: "1:control", kind: "systemNotice", content: { text: "Control: cancel" } }),
      makeItem({ id: "2:usage", kind: "metadata", content: { type: "usage" } }),
      makeItem({
        id: "1:user",
        kind: "message",
        content: { role: "user", text: "hi" },
      }),
    ];

    const result = toSharedConversationItems(items);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "1:user", kind: "message" });
  });

  it("non-user role falls back to assistant", () => {
    const result = toSharedConversationItems([
      makeItem({ id: "1:m", kind: "message", content: { role: "system", text: "x" } }),
    ]);
    expect(result[0]).toMatchObject({ kind: "message", role: "assistant" });
  });

  it("drops unknown engineSource values at the projection boundary", () => {
    const result = toSharedConversationItems([
      makeItem({
        id: "1:m",
        kind: "message",
        content: { role: "assistant", text: "x", engineSource: "future-engine" },
      }),
    ]);
    expect(result[0]).toMatchObject({ kind: "message", role: "assistant" });
    expect(result[0]?.engineSource).toBeUndefined();
  });

  it("does not mutate input and preserves order", () => {
    const items: SharedProjectionItem[] = [
      makeItem({ id: "a", kind: "message", content: { role: "user", text: "1" } }),
      makeItem({ id: "b", kind: "message", content: { role: "user", text: "2" } }),
    ];
    const snapshot = JSON.parse(JSON.stringify(items));

    const result = toSharedConversationItems(items);
    expect(items).toEqual(snapshot);
    expect(result.map((item) => item.id)).toEqual(["a", "b"]);
  });
});

describe("feature flag isolation", () => {
  it("is disabled by default", () => {
    expect(isSharedProjectionDataSourceEnabled()).toBe(false);
  });

  it("resolveSharedConversationItems returns null when flag is off", () => {
    const items: SharedProjectionItem[] = [
      makeItem({ id: "a", kind: "message", content: { role: "user", text: "hi" } }),
    ];
    expect(resolveSharedConversationItems(items)).toBeNull();
  });

  it("resolveSharedConversationItems maps when localStorage flag is on", () => {
    window.localStorage.setItem("mossx.sharedProjection", "1");
    expect(isSharedProjectionDataSourceEnabled()).toBe(true);

    const items: SharedProjectionItem[] = [
      makeItem({ id: "a", kind: "message", content: { role: "user", text: "hi" } }),
    ];
    const result = resolveSharedConversationItems(items);
    expect(result).toHaveLength(1);
  });

  it("resolveSharedConversationItems returns null for nullish input even when flag on", () => {
    window.localStorage.setItem("mossx.sharedProjection", "true");
    expect(resolveSharedConversationItems(null)).toBeNull();
    expect(resolveSharedConversationItems(undefined)).toBeNull();
  });
});
