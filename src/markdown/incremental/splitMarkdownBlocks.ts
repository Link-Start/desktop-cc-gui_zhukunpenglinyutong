/**
 * 流式 Markdown 的块级切分器（纯函数，无状态）。
 *
 * 流式期间每来一截电报就对全文做 react-markdown 全量 re-parse，成本随正文长度
 * 平方级增长。这里把正文按 CommonMark 块边界切开：已冻结（frozen）的块各自交给
 * memo 子组件，文本不变就不再重新排版；只有尾部 {@link UNSTABLE_TAIL_BLOCKS} 块
 * 每次重排。冻结规则与丝滑参考实现一致：追加文本只会改变最后一个块的形态
 * （段落变 setext 标题、未闭合 fence 继续吞行），倒数第 2 块留作安全余量。
 *
 * 切分按行扫描（不是完整 mdast parse），单帧成本是 O(行数) 的字符串扫描，
 * 比 react-markdown 全量 parse 低两个数量级。安全性论证：被冻结的块必然
 * 以「空行」或「已闭合 fence」收尾（其后至少还有 2 个块），这两种边界都不受
 * 后续追加文本影响，因此冻结块的 key / 文本在整个流式期间保证不变；未闭合
 * fence 会吞到文末、永远是最后一块，不可能被冻结。
 *
 * 已知偏差（与参考实现一致，可接受）：跨块边界的引用式链接 / 脚注在流式期间
 * 按字面渲染；松散列表在空行处被切成多个 <ul>。settle 后全量渲染自愈。
 */

export type MarkdownBlock = {
  /** 块在完整源码中的绝对起始偏移（字符串形式）；跨冻结边界 React 是 reconcile 不是 remount。 */
  key: string;
  /** 块的源码切片（含块间空行；首块之前的纯空白行被跳过，渲染等价）。 */
  text: string;
  /** 除最后 {@link UNSTABLE_TAIL_BLOCKS} 块外全部 frozen。 */
  frozen: boolean;
};

/** 尾部保留不冻结的块数：冻结规则照抄丝滑参考实现，不要改成别的数。 */
export const UNSTABLE_TAIL_BLOCKS = 2;

type FenceState = {
  marker: "`" | "~";
  length: number;
};

/**
 * CommonMark 开 fence 行：至多 3 空格缩进 + ≥3 个相同反引号/波浪号。
 * 反引号 fence 的 info string 不得再含反引号（否则是行内代码段落，不是 fence）。
 */
function matchFenceOpen(line: string): FenceState | null {
  const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
  if (!match) {
    return null;
  }
  const run = match[1] ?? "";
  const info = match[2] ?? "";
  if (run.startsWith("`") && info.includes("`")) {
    return null;
  }
  return { marker: run.startsWith("`") ? "`" : "~", length: run.length };
}

/** 闭合 fence 行：同种符号、长度 ≥ 开 fence，其余只能是空白。 */
function matchFenceClose(line: string, fence: FenceState): boolean {
  const withoutIndent = line.replace(/^ {0,3}/, "");
  let runLength = 0;
  while (withoutIndent[runLength] === fence.marker) {
    runLength += 1;
  }
  if (runLength < fence.length) {
    return false;
  }
  return withoutIndent.slice(runLength).trim() === "";
}

/**
 * 把完整源码切成顶层块。
 * @param source - 当前累积的完整 Markdown 源码。
 * @returns 按源码顺序排列的块；除最后 2 块外全部 frozen。
 */
export function splitMarkdownBlocks(source: string): MarkdownBlock[] {
  if (!source.trim()) {
    return [];
  }
  const starts: number[] = [];
  let offset = 0;
  let blockOpen = false;
  let fence: FenceState | null = null;

  for (const line of source.split("\n")) {
    if (fence) {
      if (matchFenceClose(line, fence)) {
        fence = null;
        // 闭合 fence 是独立块，紧跟其后的内容（即使没有空行）属于下一块。
        blockOpen = false;
      }
    } else if (line.trim() === "") {
      blockOpen = false;
    } else {
      if (!blockOpen) {
        starts.push(offset);
        blockOpen = true;
      }
      const openedFence = matchFenceOpen(line);
      if (openedFence) {
        fence = openedFence;
      }
    }
    offset += line.length + 1;
  }

  const unstableFrom = Math.max(0, starts.length - UNSTABLE_TAIL_BLOCKS);
  return starts.map((start, index) => ({
    key: String(start),
    text: source.slice(start, index + 1 < starts.length ? starts[index + 1] : source.length),
    frozen: index < unstableFrom,
  }));
}
