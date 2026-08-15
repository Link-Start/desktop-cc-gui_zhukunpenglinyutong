import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../types";
import {
  appendReasoningRunText,
  collapseConsecutiveReasoningRuns,
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

  it("joins A4 first-token shells inline instead of breaking mid-word", () => {
    expect(appendReasoningRunText("token", "-meter")).toBe("token-meter");
    expect(appendReasoningRunText("token", "ization")).toBe("tokenization");
    expect(appendReasoningRunText("先看配置", "，")).toBe("先看配置，");
    expect(appendReasoningRunText("，", "然后继续检查")).toBe("，然后继续检查");
  });

  it("keeps a paragraph break between sentence-complete reasoning runs", () => {
    expect(appendReasoningRunText("Let me verify the file.", "Wait for completion")).toBe(
      "Let me verify the file.\n\nWait for completion",
    );
  });

  it("does not glue two complete English thoughts at a mid-sentence tool cut", () => {
    expect(
      appendReasoningRunText("Let me check the config", "and then verify the path."),
    ).toBe("Let me check the config\n\nand then verify the path.");
    expect(appendReasoningRunText("OK", "Next I will check")).toBe(
      "OK\n\nNext I will check",
    );
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

describe("collapseConsecutiveReasoningRuns", () => {
  it("merges adjacent reasoning even when segment numbers differ", () => {
    const items: ConversationItem[] = [
      makeReasoningItem({
        id: "reasoning-a-seg-1",
        summary: "Let me verify the specific file typechecks and re-run tests.",
        content: "Let me verify the specific file typechecks and re-run tests.",
      }),
      makeReasoningItem({
        id: "reasoning-b-seg-2",
        summary: "Wait for completion",
        content: "Wait for completion",
      }),
    ];

    const collapsed = collapseConsecutiveReasoningRuns(items, true, true);
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]).toMatchObject({
      kind: "reasoning",
      id: "reasoning-b-seg-2",
    });
    if (collapsed[0]?.kind === "reasoning") {
      expect(collapsed[0].content).toContain("typechecks");
      expect(collapsed[0].content).toContain("Wait for completion");
      expect(collapsed[0].content).toContain("\n\n");
    }
  });

  it("collapses adjacent first-token reasoning shells without mid-word gaps", () => {
    const items: ConversationItem[] = [
      makeReasoningItem({
        id: "reasoning-a-seg-1",
        summary: "token",
        content: "token",
      }),
      makeReasoningItem({
        id: "reasoning-b-seg-2",
        summary: "-meter",
        content: "-meter",
      }),
    ];

    const collapsed = collapseConsecutiveReasoningRuns(items, true, true);
    expect(collapsed).toHaveLength(1);
    if (collapsed[0]?.kind === "reasoning") {
      expect(collapsed[0].content).toBe("token-meter");
    }
  });

  it("does not merge reasoning runs interrupted by a tool", () => {
    const items: ConversationItem[] = [
      makeReasoningItem({
        id: "reasoning-before",
        summary: "先思考",
        content: "先思考",
      }),
      {
        id: "tool-1",
        kind: "tool",
        toolType: "toolCall",
        title: "Tool: read",
        detail: "{}",
        status: "completed",
      },
      makeReasoningItem({
        id: "reasoning-after",
        summary: "再思考",
        content: "再思考",
      }),
    ];

    const collapsed = collapseConsecutiveReasoningRuns(items, true, true);
    expect(collapsed.map((item) => item.kind)).toEqual([
      "reasoning",
      "tool",
      "reasoning",
    ]);
  });
});
