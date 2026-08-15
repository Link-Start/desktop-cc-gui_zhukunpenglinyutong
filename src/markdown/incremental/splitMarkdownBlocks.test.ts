import { describe, expect, it } from "vitest";
import { splitMarkdownBlocks, UNSTABLE_TAIL_BLOCKS } from "./splitMarkdownBlocks";

describe("splitMarkdownBlocks", () => {
  it("keeps tail-block count aligned with UNSTABLE_TAIL_BLOCKS", () => {
    expect(UNSTABLE_TAIL_BLOCKS).toBe(2);
  });

  it("returns no blocks for empty or whitespace-only source", () => {
    expect(splitMarkdownBlocks("")).toEqual([]);
    expect(splitMarkdownBlocks("  \n\n \n")).toEqual([]);
  });

  it("splits plain paragraphs on blank lines with absolute-offset keys", () => {
    const source = "第一段落。\n\n第二段落。\n\n第三段落。";
    const blocks = splitMarkdownBlocks(source);

    expect(blocks.map((block) => block.text)).toEqual([
      "第一段落。\n\n",
      "第二段落。\n\n",
      "第三段落。",
    ]);
    // key = 块在完整源码中的绝对起始偏移（字符串形式）
    expect(blocks.map((block) => block.key)).toEqual([
      "0",
      String("第一段落。\n\n".length),
      String("第一段落。\n\n第二段落。\n\n".length),
    ]);
    // 除最后 2 块外全部 frozen
    expect(blocks.map((block) => block.frozen)).toEqual([true, false, false]);
  });

  it("keeps frozen prefix blocks untouched when text is appended", () => {
    const before = splitMarkdownBlocks("第一段落。\n\n第二段落。\n\n第三段落。");
    const after = splitMarkdownBlocks("第一段落。\n\n第二段落。\n\n第三段落。\n\n第四段落。");

    expect(after).toHaveLength(4);
    // 追加文本后，已冻结前缀块的 key / 文本不变；原尾部块允许吸收新内容（key 不变）
    expect(after[0]?.key).toBe(before[0]?.key);
    expect(after[0]?.text).toBe(before[0]?.text);
    expect(after[1]?.key).toBe(before[1]?.key);
    expect(after[1]?.text).toBe(before[1]?.text);
    expect(after[2]?.key).toBe(before[2]?.key);
    expect(after[2]?.text).toBe("第三段落。\n\n");
    expect(after.map((block) => block.frozen)).toEqual([true, true, false, false]);
  });

  it("never freezes an unclosed code fence (it stays in the tail)", () => {
    const blocks = splitMarkdownBlocks("介绍。\n\n第二段。\n\n```ts\nconst a = 1");

    expect(blocks).toHaveLength(3);
    const fenceBlock = blocks.find((block) => block.text.includes("```ts"));
    expect(fenceBlock).toBeDefined();
    expect(fenceBlock?.frozen).toBe(false);
    expect(fenceBlock?.text).toBe("```ts\nconst a = 1");

    // fence 闭合后内容继续增长，前缀块仍保持稳定
    const settled = splitMarkdownBlocks("介绍。\n\n第二段。\n\n```ts\nconst a = 1;\n```\n\n后续。");
    expect(settled.map((block) => block.key).slice(0, 3)).toEqual(
      blocks.map((block) => block.key),
    );
  });

  it("ends a closed fence block immediately, even without a blank line", () => {
    const blocks = splitMarkdownBlocks("```js\ncode\n```\n紧接着的段落\n\n第三块");

    expect(blocks.map((block) => block.text)).toEqual([
      "```js\ncode\n```\n",
      "紧接着的段落\n\n",
      "第三块",
    ]);
  });

  it("does not treat a backtick line whose info string contains backticks as a fence", () => {
    const blocks = splitMarkdownBlocks("```inline``` 不是 fence\n\n下一段");

    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.text).toBe("```inline``` 不是 fence\n\n");
  });

  it("only re-cuts the unstable tail when the second-to-last block reshapes (setext heading)", () => {
    const before = splitMarkdownBlocks("开篇。\n\n标题候选\n\n结尾段");
    expect(before.map((block) => block.frozen)).toEqual([true, false, false]);

    const after = splitMarkdownBlocks("开篇。\n\n标题候选\n---\n\n结尾段");
    // 倒数第 2 块形态改变（段落 → setext 标题）时，已冻结的更早块不动，
    // 只有它和尾部重切（尾部块长度变化会使后续块偏移整体平移，属尾部行为）
    expect(after).toHaveLength(3);
    expect(after[0]?.key).toBe(before[0]?.key);
    expect(after[0]?.text).toBe(before[0]?.text);
    expect(after[0]?.frozen).toBe(true);
    expect(after[1]?.key).toBe(before[1]?.key);
    expect(after[1]?.text).toBe("标题候选\n---\n\n");
    expect(after[2]?.text).toBe(before[2]?.text);
  });

  it("keeps a GFM table as a single block", () => {
    const source = "| 列A | 列B |\n| --- | --- |\n| 1 | 2 |\n\n后续段落。\n\n第三块。";
    const blocks = splitMarkdownBlocks(source);

    expect(blocks).toHaveLength(3);
    expect(blocks[0]?.text).toBe("| 列A | 列B |\n| --- | --- |\n| 1 | 2 |\n\n");
    expect(blocks[0]?.frozen).toBe(true);
  });

  it("splits a loose list at blank lines (settle 时全量渲染自愈)", () => {
    const blocks = splitMarkdownBlocks("- 甲\n- 乙\n\n- 丙\n\n尾声。");

    expect(blocks.map((block) => block.text)).toEqual([
      "- 甲\n- 乙\n\n",
      "- 丙\n\n",
      "尾声。",
    ]);
  });

  it("keeps a blockquote as one block", () => {
    const blocks = splitMarkdownBlocks("> 引文第一行\n> 引文第二行\n\n正文。");

    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.text).toBe("> 引文第一行\n> 引文第二行\n\n");
  });

  it("computes blocks purely from the current input (换文重置无旧缓存残留)", () => {
    void splitMarkdownBlocks("旧文本第一块。\n\n旧文本第二块。\n\n旧文本第三块。");
    const fresh = splitMarkdownBlocks("全新正文。\n\n新的第二块。");

    expect(fresh).toHaveLength(2);
    expect(fresh.map((block) => block.key)).toEqual(["0", String("全新正文。\n\n".length)]);
    expect(fresh.map((block) => block.text)).toEqual(["全新正文。\n\n", "新的第二块。"]);
  });
});
