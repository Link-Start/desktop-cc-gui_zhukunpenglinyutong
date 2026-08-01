import { describe, expect, it } from "vitest";
import {
  extractCommandMessageDisplayText,
  extractCommandMessagePromptText,
  hasCommandMessageTag,
} from "./commandMessageTags";

describe("commandMessageTags", () => {
  it("extracts command-message and command-args content", () => {
    const input = `<command-message>aimax:auto</command-message>
<command-name>/aimax:auto</command-name>
<command-args>另外我感觉打包的内容和我想的不符

我希望Mac打两个包
window 和 Linux 各打一个包</command-args>`;

    expect(extractCommandMessageDisplayText(input)).toBe(
      `aimax:auto 另外我感觉打包的内容和我想的不符

我希望Mac打两个包
window 和 Linux 各打一个包`,
    );
  });

  it("returns original text when command-message tag is missing", () => {
    const input = `<command-name>/aimax:auto</command-name>
<command-args>hello</command-args>`;
    expect(extractCommandMessageDisplayText(input)).toBe(input);
  });

  it("detects command-message tags", () => {
    expect(hasCommandMessageTag("<command-message>x</command-message>")).toBe(true);
    expect(hasCommandMessageTag("normal text")).toBe(false);
  });

  it("prefers command-args as prompt text for titles", () => {
    const input = `<command-message>aimax:code-review</command-message>
<command-name>/aimax:code-review</command-name>
<command-args>审查PR428，并告诉我他解决了什么问题</command-args>`;
    expect(extractCommandMessagePromptText(input)).toBe(
      "审查PR428，并告诉我他解决了什么问题",
    );
  });

  it("falls back to command-message then command-name when args are empty", () => {
    expect(
      extractCommandMessagePromptText(
        "<command-message>clear</command-message>\n<command-name>/clear</command-name>\n<command-args></command-args>",
      ),
    ).toBe("clear");
    expect(
      extractCommandMessagePromptText("<command-name>/resume</command-name>"),
    ).toBe("/resume");
  });

  it("returns plain text unchanged as prompt text", () => {
    expect(extractCommandMessagePromptText("普通提问")).toBe("普通提问");
  });
});
