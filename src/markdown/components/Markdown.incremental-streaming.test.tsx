// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Markdown } from "./Markdown";

describe("Markdown streaming incremental fork", () => {
  afterEach(() => {
    cleanup();
  });

  it("streams full-mode through IncrementalMarkdown with plain fences", async () => {
    const streamingValue = [
      "第一段落。",
      "",
      "```ts",
      "const answer: number = 42;",
      "export { answer };",
      "```",
      "",
      "结尾段。",
    ].join("\n");
    const { container } = render(
      <Markdown
        value={streamingValue}
        className="markdown"
        codeBlockStyle="message"
        streaming
        streamingThrottleMs={0}
      />,
    );

    // 等增量运行时真正接管（Suspense 兜底是 LightweightMarkdown，没有代码块卡片）
    await waitFor(() => {
      expect(container.querySelector(".markdown-codeblock")).toBeTruthy();
    });
    expect(container.textContent).toContain("第一段落。");
    expect(container.textContent).toContain("const answer: number = 42;");
    // 流式期间 fence 走纯文本：Prism 不上色
    expect(container.querySelector(".token")).toBeNull();
  });

  it("self-heals with the settled full render once streaming flips false", async () => {
    const value = [
      "第一段落。",
      "",
      "```ts",
      "const answer: number = 42;",
      "export { answer };",
      "```",
    ].join("\n");
    const { container, rerender } = render(
      <Markdown
        value={value}
        className="markdown"
        codeBlockStyle="message"
        streaming
        streamingThrottleMs={0}
      />,
    );
    await waitFor(() => {
      expect(container.querySelector(".markdown-codeblock")).toBeTruthy();
    });
    expect(container.querySelector(".token")).toBeNull();

    rerender(
      <Markdown
        value={value}
        className="markdown"
        codeBlockStyle="message"
        streaming={false}
        streamingThrottleMs={0}
      />,
    );
    // settle 后全量渲染补齐 Prism 高亮
    await waitFor(() => {
      expect(container.querySelector(".token")).toBeTruthy();
    });
    expect(container.textContent).toContain("const answer: number = 42;");
  });

  it("keeps rendering through the incremental path as text grows", async () => {
    const part1 = "第一段落。\n\n第二段落。\n\n第三";
    const part2 = "第一段落。\n\n第二段落。\n\n第三段落。\n\n第四段落。";
    const { container, rerender } = render(
      <Markdown value={part1} className="markdown" streaming streamingThrottleMs={0} />,
    );
    await waitFor(() => {
      expect(container.textContent).toContain("第三");
    });

    rerender(
      <Markdown value={part2} className="markdown" streaming streamingThrottleMs={0} />,
    );
    await waitFor(() => {
      expect(container.textContent).toContain("第四段落。");
    });
    expect(container.textContent).toContain("第一段落。");
  });

  it("merges grok-style first-token fragments before incremental streaming", async () => {
    const value = ["这是", "一段", "很短", "但是", "连续", "的文字"].join("\n\n");
    const { container } = render(
      <Markdown
        value={value}
        className="markdown"
        streaming
        streamingThrottleMs={0}
      />,
    );

    await waitFor(() => {
      expect(container.textContent?.replace(/\s+/g, "")).toContain(
        "这是一段很短但是连续的文字",
      );
    });
    expect(container.querySelectorAll("p").length).toBeLessThan(6);
  });
});
