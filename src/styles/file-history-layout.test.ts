import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./file-history.css", import.meta.url), "utf8");
const fileViewCss = readFileSync(new URL("./file-view-panel.css", import.meta.url), "utf8");

describe("file history layout contract", () => {
  it("uses theme tokens instead of fixed light or dark surfaces", () => {
    expect(css).toContain("var(--bg-primary)");
    expect(css).toContain("var(--bg-secondary)");
    expect(css).toContain("var(--text-primary)");
    expect(css).toContain("var(--border-subtle)");
  });

  it("sizes from the File History container and gives the diff all remaining width", () => {
    expect(css).toContain("container: file-history / inline-size");
    expect(css).toContain("grid-template-columns: clamp(240px, 26%, 360px) minmax(0, 1fr)");
    expect(css).toContain("@container file-history (max-width: 980px)");
  });

  it("stacks the commit rail above a fluid two-pane compare in narrow containers", () => {
    expect(css).toContain("@container file-history (max-width: 720px)");
    expect(css).toContain("grid-template-rows: minmax(160px, 32%) minmax(0, 1fr)");
    expect(css).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(css).toContain(".file-history-diff .editable-diff-compare .file-compare-column");
    expect(css).toContain("min-width: 0");
  });

  it("keeps semantic deletion and addition decorations for aligned read-only columns", () => {
    expect(fileViewCss).toContain(".file-compare-column.is-diff-deletion");
    expect(fileViewCss).toContain(".file-compare-column.is-diff-addition");
    expect(fileViewCss).toContain("#f85149 20%");
    expect(fileViewCss).toContain("#3fb950 20%");
  });
});
