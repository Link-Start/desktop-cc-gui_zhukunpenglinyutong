// @vitest-environment jsdom
/**
 * Shared DataSource 单元测试（Wave 3 / A3，任务 5.4）。
 *
 * 验证：映射规则、flag 隔离（默认关闭）、不污染 Native 路径。
 */

import { afterEach, describe, expect, it } from "vitest";

import {
  isSharedProjectionDataSourceEnabled,
  isSharedProjectionTestOverrideEnabled,
  resolveSharedConversationItems,
  setSharedProjectionTestOverrideEnabled,
  SHARED_PROJECTION_STORAGE_KEY,
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

  it("preserves the immutable execution target snapshot for Turn Badge", () => {
    const [item] = toSharedConversationItems([
      makeItem({
        id: "2:assistant:0",
        kind: "message",
        content: {
          role: "assistant",
          text: "done",
          engineSource: "claude",
          executionTargetSnapshot: {
            engine: "claude",
            providerProfileId: "openrouter",
            providerProfileNameSnapshot: "OpenRouter",
            model: "claude-sonnet-4-5",
            reasoning: { effort: "high" },
          },
        },
      }),
    ]);

    expect(item).toMatchObject({
      executionTargetSnapshot: {
        engine: "claude",
        providerProfileId: "openrouter",
        providerProfileNameSnapshot: "OpenRouter",
        model: "claude-sonnet-4-5",
        reasoning: { effort: "high" },
      },
    });
  });

  it("keeps distinct provider snapshots when multi-provider history is rebuilt", () => {
    const result = toSharedConversationItems([
      makeItem({
        id: "2:assistant:0",
        kind: "message",
        content: {
          role: "assistant",
          text: "Claude result",
          executionTargetSnapshot: {
            engine: "claude",
            providerProfileId: "provider-a",
            providerProfileNameSnapshot: "Provider A",
            model: "sonnet",
          },
        },
      }),
      makeItem({
        id: "4:assistant:0",
        kind: "message",
        content: {
          role: "assistant",
          text: "Codex result",
          executionTargetSnapshot: {
            engine: "codex",
            providerProfileId: "provider-b",
            providerProfileNameSnapshot: "Provider B",
            model: "gpt-5-codex",
          },
        },
      }),
    ]);

    expect(
      result.map((item) =>
        item.kind === "message" ? item.executionTargetSnapshot : null,
      ),
    ).toEqual([
      expect.objectContaining({
        engine: "claude",
        providerProfileNameSnapshot: "Provider A",
        model: "sonnet",
      }),
      expect.objectContaining({
        engine: "codex",
        providerProfileNameSnapshot: "Provider B",
        model: "gpt-5-codex",
      }),
    ]);
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

  it("persists and removes the Settings test override", () => {
    expect(isSharedProjectionTestOverrideEnabled()).toBe(false);

    expect(setSharedProjectionTestOverrideEnabled(true)).toBe(true);
    expect(window.localStorage.getItem(SHARED_PROJECTION_STORAGE_KEY)).toBe("1");
    expect(isSharedProjectionTestOverrideEnabled()).toBe(true);
    expect(setSharedProjectionTestOverrideEnabled(true)).toBe(false);

    expect(setSharedProjectionTestOverrideEnabled(false)).toBe(true);
    expect(window.localStorage.getItem(SHARED_PROJECTION_STORAGE_KEY)).toBeNull();
    expect(isSharedProjectionTestOverrideEnabled()).toBe(false);
    expect(setSharedProjectionTestOverrideEnabled(false)).toBe(false);
  });

  it("removes a disabled-looking stale override when switched off", () => {
    window.localStorage.setItem(SHARED_PROJECTION_STORAGE_KEY, "0");

    expect(setSharedProjectionTestOverrideEnabled(false)).toBe(true);
    expect(window.localStorage.getItem(SHARED_PROJECTION_STORAGE_KEY)).toBeNull();
  });
});
