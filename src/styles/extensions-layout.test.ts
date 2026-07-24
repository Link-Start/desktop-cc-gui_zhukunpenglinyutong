import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./extensions.css", import.meta.url), "utf8");

function getCssRuleBlock(selector: string): string {
  const match = css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{[^}]*\\}`, "s"));
  return match?.[0] ?? "";
}

describe("extensions layout", () => {
  it("keeps the extensions tab row pinned to the scroll container top", () => {
    const viewRule = getCssRuleBlock(".extensions-view");
    const filterRowRule = getCssRuleBlock(".extensions-filter-row");
    const filterRowMaskRule = getCssRuleBlock(".extensions-filter-row::before");

    expect(viewRule).toContain("overflow: auto;");
    expect(filterRowRule).toContain("position: sticky;");
    expect(filterRowRule).toContain("top: 0;");
    expect(filterRowRule).toContain("z-index: 100;");
    expect(filterRowRule).toContain("isolation: isolate;");
    expect(filterRowRule).toContain("background: var(--surface-messages);");
    expect(filterRowMaskRule).toContain("inset: calc(var(--titlebar-height, 44px) * -1) 0 0;");
    expect(filterRowMaskRule).toContain("background: var(--surface-messages);");
  });

  it("uses one content width across all extension tabs", () => {
    const viewRule = getCssRuleBlock(".extensions-view");

    expect(viewRule).toContain("--extensions-view-padding-inline: clamp(24px, 5vw, 96px);");
    expect(css).not.toContain(".extensions-view-usage {\n  --extensions-view-padding-inline");
  });
});
