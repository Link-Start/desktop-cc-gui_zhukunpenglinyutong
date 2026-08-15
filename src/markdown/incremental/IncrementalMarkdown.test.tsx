// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  FullMarkdownComponentProps,
  FullMarkdownComponents,
} from "../runtime/FullMarkdownRuntime";

const runtimeRenderCounts = new Map<string, number>();
let lastRuntimeComponents: FullMarkdownComponents | null = null;

vi.mock("../runtime/FullMarkdownRuntime", () => ({
  FullMarkdownRuntime: (props: { value: string; components: FullMarkdownComponents }) => {
    runtimeRenderCounts.set(props.value, (runtimeRenderCounts.get(props.value) ?? 0) + 1);
    lastRuntimeComponents = props.components;
    return <div data-testid="incremental-block">{props.value}</div>;
  },
}));

import { IncrementalMarkdown, stripStreamingCodeLanguage } from "./IncrementalMarkdown";

const baseProps = {
  components: {} as FullMarkdownComponents,
  softBreaks: false,
  urlTransform: (url: string) => url,
};

describe("IncrementalMarkdown", () => {
  beforeEach(() => {
    runtimeRenderCounts.clear();
    lastRuntimeComponents = null;
  });

  afterEach(() => {
    cleanup();
  });

  it("re-renders only the unstable tail when text is appended", () => {
    const { rerender } = render(
      <IncrementalMarkdown {...baseProps} value={"第一段落。\n\n第二段落。\n\n第三段落。"} />,
    );
    rerender(
      <IncrementalMarkdown
        {...baseProps}
        value={"第一段落。\n\n第二段落。\n\n第三段落。\n\n第四段落。"}
      />,
    );

    // 冻结块 memo 命中：不重新 parse、不重新渲染
    expect(runtimeRenderCounts.get("第一段落。\n\n")).toBe(1);
    // 跨过冻结边界的块文本不变，同样不重新渲染
    expect(runtimeRenderCounts.get("第二段落。\n\n")).toBe(1);
    // 尾部块每次正常渲染
    expect(runtimeRenderCounts.get("第三段落。\n\n")).toBe(1);
    expect(runtimeRenderCounts.get("第四段落。")).toBe(1);
    // 总渲染次数 = 首次 3 块 + 追加后尾部 2 块
    expect([...runtimeRenderCounts.values()].reduce((sum, count) => sum + count, 0)).toBe(5);
  });

  it("reconciles instead of remounting blocks across the freeze boundary", () => {
    const { container, rerender } = render(
      <IncrementalMarkdown {...baseProps} value={"第一段落。\n\n第二段落。\n\n第三段落。"} />,
    );
    const beforeNodes = Array.from(container.querySelectorAll("[data-testid=incremental-block]"));
    expect(beforeNodes).toHaveLength(3);

    rerender(
      <IncrementalMarkdown
        {...baseProps}
        value={"第一段落。\n\n第二段落。\n\n第三段落。\n\n第四段落。"}
      />,
    );
    const afterNodes = Array.from(container.querySelectorAll("[data-testid=incremental-block]"));
    expect(afterNodes).toHaveLength(4);
    // key = 源码绝对偏移，跨冻结边界 DOM 节点复用（reconcile 不是 remount）
    expect(afterNodes[0]).toBe(beforeNodes[0]);
    expect(afterNodes[1]).toBe(beforeNodes[1]);
    expect(afterNodes[2]).toBe(beforeNodes[2]);
  });

  it("drops old blocks entirely when the input is replaced (换文重置)", () => {
    const { container, rerender } = render(
      <IncrementalMarkdown {...baseProps} value={"旧文本第一块。\n\n旧文本第二块。\n\n旧文本第三块。"} />,
    );
    rerender(<IncrementalMarkdown {...baseProps} value={"全新正文。\n\n新的第二块。"} />);

    expect(container.textContent).toContain("全新正文。");
    expect(container.textContent).toContain("新的第二块。");
    expect(container.textContent).not.toContain("旧文本第一块。");
    expect(runtimeRenderCounts.get("全新正文。\n\n")).toBe(1);
    expect(runtimeRenderCounts.get("新的第二块。")).toBe(1);
  });

  it("wraps the pre renderer to strip fence language while streaming", () => {
    const preSpy = vi.fn((_props: FullMarkdownComponentProps) => null);
    const components: FullMarkdownComponents = { pre: preSpy };
    render(
      <IncrementalMarkdown
        {...baseProps}
        components={components}
        value={"```ts\nconst a = 1;\n```"}
      />,
    );

    const wrappedPre = lastRuntimeComponents?.pre;
    expect(wrappedPre).toBeDefined();
    expect(wrappedPre).not.toBe(preSpy);
    const node = {
      tagName: "pre",
      children: [
        {
          tagName: "code",
          properties: { className: ["language-ts"] },
          children: [{ value: "const a = 1;" }],
        },
      ],
    };
    wrappedPre?.({ node, children: null });
    expect(preSpy).toHaveBeenCalledTimes(1);
    const forwarded = preSpy.mock.calls[0]?.[0]?.node as {
      children: Array<{ properties?: { className?: string[] } }>;
    };
    expect(forwarded.children[0]?.properties?.className).toBeUndefined();
  });
});

describe("stripStreamingCodeLanguage", () => {
  it("strips the code className without mutating the shared hast node", () => {
    const node = {
      tagName: "pre",
      children: [
        {
          tagName: "code",
          properties: { className: ["language-ts"] },
          children: [{ value: "const a = 1;" }],
        },
      ],
    };
    const stripped = stripStreamingCodeLanguage(node) as typeof node;

    expect(stripped).not.toBe(node);
    expect(stripped.children[0]?.properties?.className).toBeUndefined();
    expect(node.children[0]?.properties?.className).toEqual(["language-ts"]);
  });

  it("returns the node as-is when there is no code className", () => {
    const plain = {
      tagName: "pre",
      children: [{ tagName: "code", children: [{ value: "x" }] }],
    };
    expect(stripStreamingCodeLanguage(plain)).toBe(plain);
    expect(stripStreamingCodeLanguage(undefined)).toBeUndefined();
  });
});
