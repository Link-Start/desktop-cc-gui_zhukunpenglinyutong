import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const vendorDialogCss = readFileSync(
  fileURLToPath(new URL("./settings.vendor-dialog.css", import.meta.url)),
  "utf8",
);

function getCssRuleBlock(css: string, selector: string): string {
  const escapedSelector = selector
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  const match = css.match(
    new RegExp(`(?:^|\\n)\\s*${escapedSelector}\\s*\\{([^}]*)\\}`),
  );
  return match?.[1] ?? "";
}

describe("vendor official config dialog layout", () => {
  it("shows Codex config.toml and auth.json editors as two visible panes on wide screens", () => {
    const bodyRule = getCssRuleBlock(
      vendorDialogCss,
      ".vendor-codex-official-dialog-body",
    );
    const editorRule = getCssRuleBlock(
      vendorDialogCss,
      ".vendor-codex-official-dialog-body .vendor-official-json-editor",
    );

    expect(bodyRule).toContain("display: grid;");
    expect(bodyRule).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(editorRule).toContain("min-height: clamp(280px, 48vh, 560px);");
  });
});
