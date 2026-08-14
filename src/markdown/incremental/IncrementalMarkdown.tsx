/**
 * 装订式增量 Markdown 渲染器：流式期间替代 FullMarkdownRuntime 的全量 re-parse。
 *
 * 输入完整累积文本 → {@link splitMarkdownBlocks} 切块 → 每个块一个独立 memo 子
 * 组件。已冻结块的文本在后续追加中保证不变，memo 命中后不再重新 parse / 渲染；
 * 每来一截电报只有尾部 ≤2 块重排，单帧排版成本与已累积正文长度脱钩。块的
 * React key 是源码绝对起始偏移，块跨过冻结边界时是 reconcile 不是 remount。
 *
 * 流式期间的刻意降级（对齐丝滑参考实现，settle 后全量渲染自愈）：
 * - 代码 fence 剥掉 language 走纯文本：Prism 同步高亮移出热路径；
 * - 不挂 rehype-katex（katexReady 恒 false）：TeX 以纯文本兜底；
 * - 跨块边界的引用式链接 / 脚注按字面渲染。
 *
 * 本组件静态引入 FullMarkdownRuntime（react-markdown 全量解析栈），因此必须像
 * FullMarkdownRuntime 一样由调用方 lazy() 引入，禁止在 Markdown.tsx 里静态 import。
 */

import { memo, useMemo } from "react";
import {
  FullMarkdownRuntime,
  type FullMarkdownComponentProps,
  type FullMarkdownComponents,
  type FullMarkdownUrlTransform,
} from "../runtime/FullMarkdownRuntime";
import type { MarkdownPreNode } from "../presentation/markdownCodeBlockHelpers";
import { splitMarkdownBlocks, type MarkdownBlock } from "./splitMarkdownBlocks";

/**
 * 剥掉 hast pre 节点里 code 子节点的 className（`language-*`），等价于参考实现的
 * 「流式期间 fence 传 lang=undefined」：PreBlock 退化为纯文本代码块（保留复制按钮
 * 与外壳样式），不跑 Prism、不触发 mermaid / latex / markdown 卡片。浅拷贝节点，
 * 不改动 react-markdown 共享的 hast 树。
 */
export function stripStreamingCodeLanguage(node: unknown): unknown {
  const preNode = node as MarkdownPreNode | undefined;
  const codeNode = preNode?.children?.find((child) => child.tagName === "code");
  if (!preNode || !codeNode?.properties?.className) {
    return node;
  }
  return {
    ...preNode,
    children: preNode.children?.map((child) =>
      child === codeNode
        ? { ...child, properties: { ...child.properties, className: undefined } }
        : child,
    ),
  };
}

type IncrementalMarkdownBlockProps = {
  block: MarkdownBlock;
  components: FullMarkdownComponents;
  softBreaks: boolean;
  urlTransform: FullMarkdownUrlTransform;
};

/**
 * 单个块的渲染单元。memo 命中条件按块文本比较（splitMarkdownBlocks 每帧返回新
 * 对象，默认浅比较会失效）：冻结块文本不变 → 跳过一次 react-markdown parse。
 */
const IncrementalMarkdownBlock = memo(
  function IncrementalMarkdownBlock({
    block,
    components,
    softBreaks,
    urlTransform,
  }: IncrementalMarkdownBlockProps) {
    return (
      <FullMarkdownRuntime
        value={block.text}
        components={components}
        softBreaks={softBreaks}
        urlTransform={urlTransform}
        katexReady={false}
      />
    );
  },
  (prev, next) =>
    prev.block.text === next.block.text &&
    prev.components === next.components &&
    prev.softBreaks === next.softBreaks &&
    prev.urlTransform === next.urlTransform,
);

export type IncrementalMarkdownProps = {
  value: string;
  components: FullMarkdownComponents;
  softBreaks: boolean;
  urlTransform: FullMarkdownUrlTransform;
};

export const IncrementalMarkdown = memo(function IncrementalMarkdown({
  value,
  components,
  softBreaks,
  urlTransform,
}: IncrementalMarkdownProps) {
  const blocks = useMemo(() => splitMarkdownBlocks(value), [value]);
  // 与 FullMarkdownRuntime 同款的 components 配置，仅包一层 pre 剥语言标记；
  // components 在 Markdown.tsx 里已 useMemo，引用稳定，本 memo 不会每帧失效。
  const streamingComponents = useMemo<FullMarkdownComponents>(() => {
    const preRenderer = components.pre;
    if (!preRenderer) {
      return components;
    }
    return {
      ...components,
      pre: (props: FullMarkdownComponentProps) =>
        preRenderer({ ...props, node: stripStreamingCodeLanguage(props.node) }),
    };
  }, [components]);

  return (
    <>
      {blocks.map((block) => (
        <IncrementalMarkdownBlock
          key={block.key}
          block={block}
          components={streamingComponents}
          softBreaks={softBreaks}
          urlTransform={urlTransform}
        />
      ))}
    </>
  );
});
