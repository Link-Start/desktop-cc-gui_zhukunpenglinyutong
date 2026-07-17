import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const mainCss = readFileSync(
  fileURLToPath(new URL("./main.css", import.meta.url)),
  "utf8",
);

function getCssRuleBlock(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = mainCss.match(
    new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "s"),
  );
  return match?.[1] ?? "";
}

describe("Git panel toolbar visual contract", () => {
  it("opens the overlay through an explicit compatibility class", () => {
    const gitToolbarRule = getCssRuleBlock(
      ".right-panel-toolbar.has-git-mode-slot",
    );

    expect(gitToolbarRule).toContain("overflow: visible");
    expect(mainCss).not.toContain(
      ".right-panel-toolbar:has(.right-panel-git-mode-slot)",
    );
  });
});
