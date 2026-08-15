// @vitest-environment jsdom
/**
 * Task 6.2 自动化代理测量（替代手动 Profiler）：
 * 对比「全量 re-parse」（FullMarkdownRuntime，流式前旧路径）与「增量路径」
 * （IncrementalMarkdown）在正文 1k / 10k / 50k 字时追加一截电报的单帧
 * 渲染 + parse 耗时。jsdom 下用 performance.now() 包裹同步 rerender，
 * 多轮取中位数。增量路径应与正文长度基本脱钩。
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FullMarkdownRuntime } from "../../runtime/FullMarkdownRuntime";
import type { FullMarkdownComponents } from "../../runtime/FullMarkdownRuntime";
import { IncrementalMarkdown } from "../IncrementalMarkdown";

const COMPONENTS: FullMarkdownComponents = {};
const urlTransform = (url: string) => url;
const ROUNDS = 7;

/** 构造贴近真实长回答的正文：段落 + 列表 + 表格 + 代码 fence 的混合块序列。 */
function buildBody(targetChars: number): string {
  const proseSection = [
    "这是一段用于性能测量的正文，包含 **加粗强调**、`行内代码` 与 [示例链接](https://example.com)。",
    "流式回答里大量都是这样的普通段落，长度接近真实助手输出，用于放大全量重解析的成本差异。",
    "",
    "- 第一条要点，说明某个结论",
    "- 第二条要点，补充更多细节",
    "- 第三条要点，收尾这一段落",
    "",
  ].join("\n");
  const structuredSection = [
    "| 指标 | 数值 |",
    "| --- | --- |",
    "| 耗时 | 42ms |",
    "| 成功率 | 99% |",
    "",
    "```ts",
    "const result = computeSomething(input);",
    "console.log(result);",
    "```",
    "",
  ].join("\n");
  let body = "";
  let index = 0;
  while (body.length < targetChars) {
    body += index % 2 === 0 ? proseSection : structuredSection;
    index += 1;
  }
  return body;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/**
 * 先挂载完整正文（暖机，不计时），再逐轮追加一截电报并测量同步
 * rerender（parse + reconcile）耗时，取中位数。
 */
function measureAppendFrameMs(mode: "full" | "incremental", bodyChars: number): number {
  let text = buildBody(bodyChars);
  const element = (value: string) =>
    mode === "full" ? (
      <FullMarkdownRuntime
        value={value}
        components={COMPONENTS}
        softBreaks={false}
        katexReady={false}
        urlTransform={urlTransform}
      />
    ) : (
      <IncrementalMarkdown
        value={value}
        components={COMPONENTS}
        softBreaks={false}
        urlTransform={urlTransform}
      />
    );
  const view = render(element(text));
  const samples: number[] = [];
  for (let round = 0; round < ROUNDS; round += 1) {
    text += `\n\n追加第 ${round + 1} 段内容，模拟一截流式电报到达后的排版更新。`;
    const start = performance.now();
    view.rerender(element(text));
    samples.push(performance.now() - start);
  }
  view.unmount();
  return median(samples);
}

describe("incremental streaming render perf (Task 6.2)", () => {
  afterEach(() => {
    cleanup();
  });

  it("decouples append-frame cost from accumulated body length", () => {
    const results: Array<{ mode: string; bodyChars: number; medianMs: number }> = [];
    for (const bodyChars of [1_000, 10_000, 50_000]) {
      results.push({
        mode: "full-reparse",
        bodyChars,
        medianMs: measureAppendFrameMs("full", bodyChars),
      });
      results.push({
        mode: "incremental",
        bodyChars,
        medianMs: measureAppendFrameMs("incremental", bodyChars),
      });
    }
    // 结构化单行输出，便于复制进执行记录
    console.info(`[incremental-perf] ${JSON.stringify(results)}`);

    const read = (mode: string, bodyChars: number) =>
      results.find((entry) => entry.mode === mode && entry.bodyChars === bodyChars)?.medianMs ?? 0;
    const full50k = read("full-reparse", 50_000);
    const incremental1k = read("incremental", 1_000);
    const incremental50k = read("incremental", 50_000);

    // 长正文下增量路径必须显著快于全量重解析
    expect(incremental50k).toBeLessThan(full50k);
    // 脱钩：50k 与 1k 的单帧耗时处于同一量级（16ms 帧预算兜底，防快机抖动）
    expect(incremental50k).toBeLessThan(Math.max(incremental1k * 8, 16));
  }, 120_000);
});
