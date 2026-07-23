import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readStyleSheet(fileName: string) {
  return readFileSync(
    fileURLToPath(new URL(`./${fileName}`, import.meta.url)),
    "utf8",
  );
}

function getCssRuleBlock(css: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const match = css.match(new RegExp(`(?:^|\\n)${escapedSelector}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? "";
}

const mainCss = readStyleSheet("main.css");
const darkThemeCss = readStyleSheet("themes.dark.css");
const lightThemeCss = readStyleSheet("themes.light.css");
const systemThemeCss = readStyleSheet("themes.system.css");

describe("desktop shell theme contract", () => {
  it("defines dark desktop surfaces for explicit and system-dark appearances", () => {
    expect(darkThemeCss).toContain(
      "--desktop-shell-background: var(--surface-messages)",
    );
    expect(darkThemeCss).toContain(
      "--desktop-sidebar-background: var(--surface-sidebar)",
    );
    expect(darkThemeCss).toContain(
      "--desktop-main-background: var(--surface-messages)",
    );
  });

  it("keeps collapsed shell fallbacks theme-aware instead of light-only", () => {
    const collapsedRule = mainCss.match(
      /\.app\.layout-desktop\.sidebar-collapsed\s*\{[\s\S]*?\n\}/,
    )?.[0];

    expect(collapsedRule).toBeDefined();
    expect(collapsedRule).not.toContain("#ffffff");
    expect(collapsedRule).toContain("var(--surface-messages, #0d0f14)");
  });

  it("preserves explicit-light and system-light collapsed shell overrides", () => {
    expect(lightThemeCss).toMatch(
      /:root\[data-theme="light"\] \.app\.layout-desktop\.sidebar-collapsed\s*\{[^}]*--desktop-shell-background:\s*#ffffff[^}]*--desktop-sidebar-background:\s*#ffffff/s,
    );
    expect(systemThemeCss).toMatch(
      /:root:not\(\[data-theme\]\) \.app\.layout-desktop\.sidebar-collapsed\s*\{[^}]*--desktop-shell-background:\s*#ffffff[^}]*--desktop-sidebar-background:\s*#ffffff/s,
    );
  });

  it("keeps the workspace project dropdown aligned with shadcn menu tokens", () => {
    const dropdownRule = getCssRuleBlock(mainCss, ".workspace-project-dropdown");
    const searchRule = getCssRuleBlock(mainCss, ".workspace-project-search");
    const itemRule = getCssRuleBlock(mainCss, ".workspace-project-item");
    const activeItemRule = getCssRuleBlock(mainCss, ".workspace-project-item.is-active");

    expect(dropdownRule).toContain("border-radius: var(--radius-md, 8px);");
    expect(dropdownRule).toContain("background: var(--popover);");
    expect(dropdownRule).toContain("color: var(--popover-foreground);");
    expect(dropdownRule).not.toContain("border-radius: 18px;");
    expect(searchRule).toContain("border-bottom: 1px solid var(--border);");
    expect(searchRule).toContain("background: transparent;");
    expect(itemRule).toContain("min-height: 32px;");
    expect(itemRule).toContain("border-radius: var(--radius-sm, 6px);");
    expect(activeItemRule).toContain("background: var(--accent);");
    expect(activeItemRule).toContain("color: var(--accent-foreground);");
    expect(activeItemRule).not.toContain("#ffffff");
  });
});
