import { describe, expect, it } from "vitest";
import {
  normalizeFragmentedLineBreaks,
  normalizeFragmentedParagraphBreaks,
  normalizeGithubBlockquoteAlerts,
  normalizeInlineOrderedListBreaks,
  normalizeListIndentation,
} from "./markdownTextNormalizers";

describe("markdownTextNormalizers", () => {
  it("normalizes compact inline ordered list markers after punctuation", () => {
    expect(
      normalizeInlineOrderedListBreaks(
        "我看到这些事实：1.当前目录存在 2.这是 git 仓库",
      ),
    ).toBe("我看到这些事实：\n1. 当前目录存在 2.这是 git 仓库");
  });

  it("keeps decimal-looking ordered markers intact", () => {
    expect(normalizeListIndentation("版本号 1.23 不应该变成列表")).toBe(
      "版本号 1.23 不应该变成列表",
    );
  });

  it("indents nested bullets under an active ordered item", () => {
    expect(
      normalizeListIndentation(
        ["1. 第一步", " - 先检查", " - 再处理", "2. 第二步"].join("\n"),
      ),
    ).toBe(
      ["1. 第一步", "    - 先检查", "    - 再处理", "2. 第二步"].join("\n"),
    );
  });

  it("converts supported GitHub blockquote alerts to markdown alert labels", () => {
    expect(
      normalizeGithubBlockquoteAlerts(["> [!WARNING]", "> 注意这里"].join("\n")),
    ).toBe(
      [
        '> <span class="markdown-alert-label markdown-alert-label-warning">WARNING</span>',
        ">",
        "> 注意这里",
      ].join("\n"),
    );
  });

  it("merges fragmented short paragraphs when a long enough run is present", () => {
    expect(
      normalizeFragmentedParagraphBreaks(
        ["这是", "一段", "很短", "但是", "连续", "的文字"].join("\n\n"),
      ),
    ).toBe("这是一段很短但是连续的文字");
  });

  it("merges CJK-dominant fragmented short lines", () => {
    expect(
      normalizeFragmentedLineBreaks(
        ["这是", "一段", "很短", "但是", "连续", "的中文"].join("\n"),
      ),
    ).toBe("这是一段很短但是连续的中文");
  });
});
