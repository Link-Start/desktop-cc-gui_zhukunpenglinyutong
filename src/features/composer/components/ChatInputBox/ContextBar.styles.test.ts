import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const contextBarCss = readFileSync(
  fileURLToPath(new URL("./styles/context-bar.css", import.meta.url)),
  "utf8",
);

function getCssRule(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return contextBarCss.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "s"))?.[1] ?? "";
}

describe("Codex footer context indicator styles", () => {
  it("matches the Claude footer indicator geometry and muted foreground", () => {
    const summaryRule = getCssRule(
      ".composer-branch-row-usage .context-bar--tool-popover .context-dual-usage",
    );
    const percentageRule = getCssRule(
      ".composer-branch-row-usage .context-dual-usage-percent",
    );
    const ringRule = getCssRule(
      ".composer-branch-row-usage .context-dual-usage svg",
    );

    expect(summaryRule).toContain("height: 28px;");
    expect(summaryRule).toContain("gap: 6px;");
    expect(summaryRule).toContain("padding: 0 8px;");
    expect(summaryRule).toContain("background: transparent;");
    expect(summaryRule).toContain("color: var(--text-muted);");
    expect(percentageRule).toContain("font-size: 12px;");
    expect(percentageRule).toContain("font-weight: 500;");
    expect(ringRule).toContain("width: 14px;");
    expect(ringRule).toContain("height: 14px;");
  });

  it("anchors the Codex detail tooltip upward from the footer right edge", () => {
    const tooltipRule = getCssRule(
      ".composer-branch-row-usage .context-dual-tooltip",
    );

    expect(tooltipRule).toContain("right: 0;");
    expect(tooltipRule).toContain("left: auto;");
    expect(getCssRule(".context-dual-tooltip")).toContain(
      "bottom: calc(100% + 2px);",
    );
  });

  it("uses theme-aware tooltip surface fallbacks outside .chat-input-box", () => {
    const dualRule = getCssRule(".context-dual-tooltip");
    const itemRule = getCssRule(".context-item.has-tooltip:hover::after");
    const popupRule = getCssRule(".tooltip-popup");

    // Footer dual-view mounts under .composer-branch-row-usage, not
    // .chat-input-box, so background must not hard-depend on scoped vars only.
    for (const tooltipRule of [dualRule, itemRule, popupRule]) {
      expect(tooltipRule).toContain("--tooltip-bg");
      expect(tooltipRule).toContain("--surface-popover");
      expect(tooltipRule).not.toMatch(
        /background:\s*var\(--tooltip-bg,\s*#1a1c24\)/,
      );
    }
  });
});
