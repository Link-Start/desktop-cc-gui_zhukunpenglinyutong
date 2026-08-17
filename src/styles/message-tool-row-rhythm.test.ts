import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const messagesShellCss = readFileSync(
  fileURLToPath(new URL("./messages.part1-shell.css", import.meta.url)),
  "utf8",
);
const messagesPart1Css = readFileSync(
  fileURLToPath(new URL("./messages.part1.css", import.meta.url)),
  "utf8",
);
const messagesPart2Css = readFileSync(
  fileURLToPath(new URL("./messages.part2.css", import.meta.url)),
  "utf8",
);

function getCssRuleBlock(css: string, selector: string): string {
  const escapedSelector = selector
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  const match = css.match(new RegExp(`(?:^|\\n)${escapedSelector}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? "";
}

describe("message activity row vertical rhythm", () => {
  it("does not put margin-top on thinking-content (CollapsibleReveal inner leaks when 0fr)", () => {
    const thinkingContent = getCssRuleBlock(messagesPart2Css, ".thinking-content");
    expect(thinkingContent).not.toMatch(/margin-top\s*:/);
    expect(thinkingContent).toContain("font-size: var(--message-caption-font-size);");
    expect(
      getCssRuleBlock(messagesPart2Css, ".thinking-content > *"),
    ).toContain("margin-top: var(--message-tool-row-margin-y, 8px);");
  });

  it("clips keepMounted thinking reveal while collapsed", () => {
    expect(
      getCssRuleBlock(messagesPart2Css, ".thinking-content-reveal:not(.is-open)"),
    ).toContain("overflow: hidden");
  });

  it("neutralizes nested tool/explore margins inside the timeline shell", () => {
    const nested = getCssRuleBlock(
      messagesShellCss,
      ".message-tool-block-shell > :is(.explore-inline, .tool-inline, .tcb-marker)",
    );
    expect(nested).toMatch(/margin:\s*0/);
  });

  it("collapses adjacent activity-row outer margins to a single beat", () => {
    const adjacent = getCssRuleBlock(
      messagesShellCss,
      ":is(.thinking-block, .explore-inline, .message-tool-block-shell, .tcb-marker) + :is(.thinking-block, .explore-inline, .message-tool-block-shell, .tcb-marker)",
    );
    expect(adjacent).toMatch(/margin-top:\s*0/);
  });

  it("keeps explore-inline on the same outer token as thinking, not tool-inline 8/12", () => {
    expect(getCssRuleBlock(messagesPart1Css, ".explore-inline")).toContain(
      "margin: var(--message-tool-row-margin-y, 8px) 0;",
    );
    expect(getCssRuleBlock(messagesPart1Css, ".tool-inline")).toContain(
      "margin: 8px 0 12px;",
    );
  });

  it("keeps thinking markdown tighter than the later document-style 1.5em gap", () => {
    expect(
      getCssRuleBlock(messagesPart2Css, ".thinking-block .reasoning-markdown > * + *"),
    ).toContain("margin-top: 0.4em;");
    expect(
      getCssRuleBlock(messagesPart2Css, ".thinking-block .reasoning-markdown :where(ul, ol)"),
    ).toContain("margin: 0.12em 0;");
    expect(getCssRuleBlock(messagesPart2Css, ".markdown > * + *")).toContain(
      "margin-top: 1.5em;",
    );
  });
});
