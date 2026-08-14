// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PreBlock, type PreProps } from "../components/MarkdownBlocks";
import type { FullMarkdownComponents } from "../runtime/FullMarkdownRuntime";
import { IncrementalMarkdown } from "./IncrementalMarkdown";

function createMessageComponents(sourceMarkdown: string): FullMarkdownComponents {
  return {
    pre: ({ node, children }) => (
      <PreBlock
        node={node as PreProps["node"]}
        copyUseModifier={false}
        sourceMarkdown={sourceMarkdown}
        workspaceId={null}
      >
        {children}
      </PreBlock>
    ),
  };
}

describe("IncrementalMarkdown integration (real FullMarkdownRuntime)", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders blocks with the full markdown pipeline (paragraphs / table / fence)", () => {
    const value = [
      "开篇段落，含 **加粗** 文本。",
      "",
      "| 列A | 列B |",
      "| --- | --- |",
      "| 1 | 2 |",
      "",
      "```ts",
      "const answer = 42;",
      "```",
    ].join("\n");

    const { container } = render(
      <IncrementalMarkdown
        value={value}
        components={createMessageComponents(value)}
        softBreaks={false}
        urlTransform={(url) => url}
      />,
    );

    expect(container.querySelector("strong")?.textContent).toBe("加粗");
    expect(container.querySelector("table")).toBeTruthy();
    expect(container.textContent).toContain("const answer = 42;");
  });

  it("renders code fences as plain text while streaming (Prism 移出热路径)", () => {
    const value = ["```ts", "const answer: number = 42;", "export { answer };", "```"].join("\n");

    const { container } = render(
      <IncrementalMarkdown
        value={value}
        components={createMessageComponents(value)}
        softBreaks={false}
        urlTransform={(url) => url}
      />,
    );

    expect(container.textContent).toContain("const answer: number = 42;");
    // 剥掉 language 后不跑 Prism：没有 token 上色节点
    expect(container.querySelector(".token")).toBeNull();
    // 外壳样式（代码块卡片 + 复制按钮结构）保持与 settle 后一致
    expect(container.querySelector(".markdown-codeblock")).toBeTruthy();
  });

  it("does not render TeX while streaming (settle 后全量渲染自愈)", () => {
    const value = ["行内公式 $x^2 + y^2$ 示例。", "", "结尾段。"].join("\n");

    const { container } = render(
      <IncrementalMarkdown
        value={value}
        components={createMessageComponents(value)}
        softBreaks={false}
        urlTransform={(url) => url}
      />,
    );

    expect(container.querySelector(".katex")).toBeNull();
    expect(container.textContent).toContain("x^2 + y^2");
  });
});
