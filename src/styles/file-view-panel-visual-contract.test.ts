import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const fileViewPanelCss = readFileSync(
  fileURLToPath(new URL("./file-view-panel.css", import.meta.url)),
  "utf8",
);
const diffViewerCss = readFileSync(
  fileURLToPath(new URL("./diff-viewer.css", import.meta.url)),
  "utf8",
);

function getCssRuleBlock(css: string, selector: string): string {
  const escapedSelector = selector
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  const match = css.match(new RegExp(`(?:^|\\n)${escapedSelector}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? "";
}

describe("file view visual contracts", () => {
  it("keeps annotation cards compact with unified small action buttons", () => {
    expect(getCssRuleBlock(fileViewPanelCss, ".fvp-annotation-draft")).toContain(
      "border-radius: 8px;",
    );
    expect(getCssRuleBlock(diffViewerCss, ".diff-annotation-draft")).toContain(
      "border-radius: 8px;",
    );
    expect(getCssRuleBlock(fileViewPanelCss, ".fvp-annotation-submit")).toContain(
      "min-height: 28px;",
    );
    expect(getCssRuleBlock(fileViewPanelCss, ".fvp-annotation-submit")).toContain(
      "border-radius: 8px;",
    );
    expect(getCssRuleBlock(fileViewPanelCss, ".fvp-annotation-draft-actions button")).toContain(
      "min-height: 28px;",
    );
    expect(getCssRuleBlock(fileViewPanelCss, ".fvp-annotation-draft-actions button")).toContain(
      "border-radius: 8px;",
    );
    expect(getCssRuleBlock(fileViewPanelCss, ".fvp-annotation-submit")).toContain(
      "background: var(--surface-panel);",
    );
    expect(getCssRuleBlock(diffViewerCss, ".diff-annotation-draft-actions button")).toContain(
      "min-height: 28px;",
    );
    expect(getCssRuleBlock(diffViewerCss, ".diff-annotation-draft-actions button")).toContain(
      "border-radius: 8px;",
    );
    expect(getCssRuleBlock(diffViewerCss, ".diff-annotation-draft-actions button:not(.ghost)")).toContain(
      "background: color-mix(in srgb, var(--surface-panel) 96%, transparent);",
    );
  });

  it("keeps the markdown outline flyout subordinate to the document", () => {
    const outlineRule = getCssRuleBlock(
      fileViewPanelCss,
      ".fvp-markdown-outline-layer .fvp-preview-outline",
    );
    const outlineButtonRule = getCssRuleBlock(fileViewPanelCss, ".fvp-preview-outline-button");
    const pinButtonRule = getCssRuleBlock(fileViewPanelCss, ".fvp-preview-outline-pin-button");
    const pinIconRule = getCssRuleBlock(fileViewPanelCss, ".fvp-preview-outline-pin-icon");

    expect(outlineRule).toContain("width: min(320px, calc(100% - 40px));");
    expect(outlineRule).toContain("max-height: min(520px, calc(100% - 40px));");
    expect(outlineButtonRule).toContain("font-size: 13px;");
    expect(pinButtonRule).toContain("color: var(--fvp-reader-muted);");
    expect(pinIconRule).toContain("width: 18px;");
    expect(pinIconRule).toContain("height: 18px;");
  });

  it("uses README-style readable blue links in file markdown", () => {
    const linkRule = getCssRuleBlock(fileViewPanelCss, ".fvp-file-markdown :where(a)");

    expect(linkRule).toContain("color: var(--fvp-markdown-link, #0969da);");
    expect(linkRule).toContain("text-underline-offset: 0.14em;");
  });

  it("keeps markdown annotation drafts out of document flow", () => {
    const activeBlockRule = getCssRuleBlock(
      fileViewPanelCss,
      ".fvp-markdown-annotatable-block:has(.fvp-markdown-annotation-popover)",
    );
    const popoverRule = getCssRuleBlock(fileViewPanelCss, ".fvp-markdown-annotation-popover");
    const draftRule = getCssRuleBlock(fileViewPanelCss, ".fvp-annotation-draft");
    const inputRule = getCssRuleBlock(fileViewPanelCss, ".fvp-annotation-draft-input");

    expect(activeBlockRule).toContain("z-index: 20;");
    expect(popoverRule).toContain("position: absolute;");
    // Draft popover hugs the top-right "annotate" button instead of the block bottom.
    expect(popoverRule).toContain("top: 32px;");
    expect(popoverRule).toContain("right: 0;");
    expect(popoverRule).toContain("z-index: 20;");
    expect(popoverRule).toContain("pointer-events: auto;");
    expect(popoverRule).toContain("background: var(--bg-primary);");
    expect(draftRule).toContain("background: var(--bg-primary);");
    expect(inputRule).toContain("background: var(--bg-primary);");
  });
});
