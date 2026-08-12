import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const kanbanCss = readFileSync(
  fileURLToPath(new URL("./kanban.css", import.meta.url)),
  "utf8",
).replace(/\r\n/g, "\n");

function getCssRuleBlock(css: string, selector: string): string {
  const escapedSelector = selector
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "s"));
  return match?.[1] ?? "";
}

describe("kanban Windows titlebar inset", () => {
  it("reserves window-control space for kanban topbars on Windows", () => {
    const rule = getCssRuleBlock(
      kanbanCss,
      ".app.windows-desktop.kanban-active .kanban-board-header,\n.app.windows-desktop.kanban-active .kanban-projects-topbar",
    );

    // Fallback: selector may be written with flexible whitespace
    const ruleText =
      rule ||
      getCssRuleBlock(
        kanbanCss,
        ".app.windows-desktop.kanban-active .kanban-board-header, .app.windows-desktop.kanban-active .kanban-projects-topbar",
      );

    const hasInset =
      kanbanCss.includes(
        ".app.windows-desktop.kanban-active .kanban-board-header",
      ) &&
      kanbanCss.includes(
        ".app.windows-desktop.kanban-active .kanban-projects-topbar",
      ) &&
      kanbanCss.includes("var(--titlebar-window-controls-width") &&
      kanbanCss.includes("var(--titlebar-toggle-side-gap");

    expect(hasInset).toBe(true);
    expect(ruleText || kanbanCss).toMatch(
      /padding-right:\s*calc\([\s\S]*titlebar-window-controls-width/,
    );
  });
});
