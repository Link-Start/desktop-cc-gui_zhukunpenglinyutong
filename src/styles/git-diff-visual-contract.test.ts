import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const diffCss = readFileSync(
  fileURLToPath(new URL("./diff.css", import.meta.url)),
  "utf8",
);

function getCssRuleBlock(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = diffCss.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "s"));
  return match?.[1] ?? "";
}

describe("git diff visual contract", () => {
  it("keeps the diff file list vertically scrollable without horizontal overflow", () => {
    const diffListRule = getCssRuleBlock(".diff-list");

    expect(diffListRule).toContain("overflow-x: hidden");
    expect(diffListRule).toContain("overflow-y: auto");
  });

  it("keeps the manual refresh action hidden until the section header is active", () => {
    const rootActionRule = getCssRuleBlock(".diff-tree-summary-root-action");

    expect(rootActionRule).toMatch(/opacity:\s*0/);
    expect(rootActionRule).toMatch(/pointer-events:\s*none/);
    expect(diffCss).toMatch(
      /\.diff-section-title:hover \.diff-tree-summary-root-action,\s*\.diff-section-title:focus-within \.diff-tree-summary-root-action\s*\{[^}]*opacity:\s*1/s,
    );
    expect(diffCss).toMatch(
      /\.diff-section-title:hover \.diff-tree-summary-root-action,\s*\.diff-section-title:focus-within \.diff-tree-summary-root-action\s*\{[^}]*pointer-events:\s*auto/s,
    );
  });

  it("uses warning color for modified file status letters", () => {
    const modifiedRule = getCssRuleBlock('.diff-row[data-status="M"]');

    expect(modifiedRule).toContain("var(--status-warning");
    expect(modifiedRule).not.toContain("var(--text-accent");
  });

  it("keeps staged section labels at the normal section color", () => {
    const stagedRule = getCssRuleBlock(".diff-section-indicator.is-staged");

    expect(stagedRule).toContain("var(--text-secondary)");
    expect(stagedRule).not.toContain("var(--status-success");
  });
});
