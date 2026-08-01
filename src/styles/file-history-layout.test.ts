import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./file-history.css", import.meta.url), "utf8");
const diffCss = readFileSync(new URL("./diff.css", import.meta.url), "utf8");
const fileViewCss = readFileSync(new URL("./file-view-panel.css", import.meta.url), "utf8");

describe("file history layout contract", () => {
  it("uses theme tokens instead of fixed light or dark surfaces", () => {
    expect(css).toContain("var(--bg-primary)");
    expect(css).toContain("var(--bg-secondary)");
    expect(css).toContain("var(--text-primary)");
    expect(css).toContain("var(--border-subtle)");
  });

  it("declares the local rail splitter and the shared resizable compare splitter", () => {
    expect(css).toContain(".file-history-vertical-resizer");
    expect(css).toContain("var(--file-history-commit-rail-width, 300px)");
    expect(diffCss).toContain(".read-only-compare-resizer");
    expect(diffCss).toContain("var(--read-only-previous-column-ratio, 0.5fr)");
    expect(diffCss).toContain("var(--read-only-source-column-ratio, 0.5fr)");
  });

  it("keeps the inline-size container breakpoint and narrow stack layout", () => {
    expect(css).toContain("container: file-history / inline-size");
    expect(css).toContain("@container file-history (max-width: 980px)");
    expect(css).toContain("@container file-history (max-width: 720px)");
    // narrow container: both splitters are hidden and the workbench has two rows.
    const breakpointStart = css.indexOf("@container file-history (max-width: 720px)");
    expect(breakpointStart).toBeGreaterThanOrEqual(0);
    const stack = css.slice(breakpointStart);
    expect(stack).toMatch(/\.file-history-vertical-resizer\s*\{\s*display:\s*none/);
    expect(stack).toMatch(/\.file-history-diff \.read-only-compare-resizer\s*\{\s*display:\s*none/);
    expect(stack).toContain("grid-template-rows: minmax(160px, 32%) minmax(0, 1fr)");
  });

  it("lets CodeMirror scroll horizontally for long diff lines instead of clipping them", () => {
    expect(css).toMatch(/\.file-history-diff \.file-compare-cm \.cm-scroller\s*\{\s*overflow:\s*auto/);
    // The columns container must not use `overflow: hidden` because that would clip long lines.
    const hiddenColumns = css.match(/\.file-history-diff \.editable-diff-compare-columns[^{]*\{[^}]*overflow:\s*hidden[^}]*\}/);
    expect(hiddenColumns).toBeNull();
  });

  it("keeps semantic deletion and addition decorations for aligned read-only columns", () => {
    expect(fileViewCss).toContain(".file-compare-column.is-diff-deletion");
    expect(fileViewCss).toContain(".file-compare-column.is-diff-addition");
    expect(fileViewCss).toContain("#f85149 20%");
    expect(fileViewCss).toContain("#3fb950 20%");
  });
});
