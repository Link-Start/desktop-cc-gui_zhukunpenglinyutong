import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./git-history.part1-shell.css", import.meta.url), "utf8");

describe("Git History document tabs layout", () => {
  it("keeps tabs in the existing toolbar row without growing the panel", () => {
    expect(css).not.toMatch(/\.git-history-document-titlebar\s*\{/);
    expect(css).toMatch(/\.git-history-document-tabs\s*\{[^}]*min-width:\s*0;/s);
    expect(css).toMatch(/\.git-history-document-tabs\s*\{[^}]*overflow-x:\s*auto;/s);
    expect(css).toMatch(/\.git-history-toolbar-left\s*\{[^}]*flex-wrap:\s*nowrap;/s);
    expect(css).toMatch(/\.git-history-document-panel\s*\{[^}]*min-height:\s*0;/s);
    expect(css).toMatch(/\.git-history-document-tab:focus-visible[\s\S]*?outline:\s*none;/);
    expect(css).toMatch(/\.git-history-document-tab\[aria-selected="true"\][\s\S]*?inset 0 -2px 0/);
    expect(css).toMatch(/\.git-history-document-tabs > \.git-history-document-tab\s*\{[^}]*flex:\s*0 0 28px;/s);
    expect(css).toMatch(/\.git-history-document-tab-shell\s*\{[^}]*flex:\s*0 1 auto;/s);
    expect(css).toMatch(/\.git-history-document-tab-close\s*\{[^}]*flex:\s*0 0 18px;[^}]*padding:\s*0;[^}]*line-height:\s*0;/s);
    expect(css).toMatch(/\.git-history-document-tab-close svg\s*\{[^}]*display:\s*block;/s);
  });
});
