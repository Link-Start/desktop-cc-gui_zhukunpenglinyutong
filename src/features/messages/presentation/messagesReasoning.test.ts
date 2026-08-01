import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../types";
import {
  appendReasoningRunText,
  compactComparableReasoningText,
  parseReasoning,
} from "./messagesReasoning";

type ReasoningItem = Extract<ConversationItem, { kind: "reasoning" }>;

function makeReasoningItem(overrides: Partial<ReasoningItem> = {}): ReasoningItem {
  return {
    id: "reasoning-1",
    kind: "reasoning",
    summary: "分析问题",
    content: "分析问题\n\n先看整体结构，再定位热点。",
    ...overrides,
  } as ReasoningItem;
}

describe("appendReasoningRunText", () => {
  it("appends non-overlapping text with a paragraph break", () => {
    expect(appendReasoningRunText("第一段结论。", "第二段结论。")).toBe(
      "第一段结论。\n\n第二段结论。",
    );
  });

  it("keeps existing text when incoming is a full duplicate", () => {
    const text = "同一段完整重复的思考内容，长度足够参与比较。";
    expect(appendReasoningRunText(text, text)).toBe(text);
  });

  it("detects suffix/prefix overlap and appends only the new tail", () => {
    const existing = "模型先阅读了配置文件，然后开始检查渲染路径";
    const incoming = "然后开始检查渲染路径，最终定位到热点函数";
    expect(appendReasoningRunText(existing, incoming)).toBe(
      "模型先阅读了配置文件，然后开始检查渲染路径，最终定位到热点函数",
    );
  });

  it("detects overlap across differing whitespace/punctuation forms", () => {
    const existing = "step one done. step two started";
    const incoming = "step two started, step three next";
    expect(appendReasoningRunText(existing, incoming)).toBe(
      "step one done. step two started, step three next",
    );
  });

  it("stays fast for long non-overlapping inputs", () => {
    const existing = "甲".repeat(30000);
    const incoming = "乙".repeat(30000);
    const startedAt = performance.now();
    const merged = appendReasoningRunText(existing, incoming);
    const elapsedMs = performance.now() - startedAt;
    expect(merged).toBe(`${existing}\n\n${incoming}`);
    // 旧实现是 O(n²)（30k 字符需要数百 ms 到秒级）；线性实现应远低于 100ms。
    expect(elapsedMs).toBeLessThan(100);
  });

  it("handles long streaming-style growth where incoming extends existing", () => {
    const base = "推理内容".repeat(5000);
    const incoming = `${base}新增的尾部增量`;
    expect(appendReasoningRunText(base, incoming)).toBe(incoming);
  });
});

describe("compactComparableReasoningText", () => {
  it("normalizes whitespace and full-width punctuation", () => {
    expect(compactComparableReasoningText("你好， 世界！\n结束。")).toBe(
      "你好,世界!结束.",
    );
  });

  it("returns cached result for repeated inputs", () => {
    const input = "重复输入的思考文本，应命中缓存。";
    expect(compactComparableReasoningText(input)).toBe(
      compactComparableReasoningText(input),
    );
  });
});

describe("parseReasoning cache", () => {
  it("returns the same reference for the same item reference", () => {
    const item = makeReasoningItem();
    expect(parseReasoning(item)).toBe(parseReasoning(item));
  });

  it("recomputes for a new item reference", () => {
    const item = makeReasoningItem();
    const updated = makeReasoningItem({
      content: "分析问题\n\n先看整体结构，再定位热点。补充一段新的推理。",
    });
    const first = parseReasoning(item);
    const second = parseReasoning(updated);
    expect(second).not.toBe(first);
    expect(second.bodyText).toContain("补充一段新的推理");
  });
});
