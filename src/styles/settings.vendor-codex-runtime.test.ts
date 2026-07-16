import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const runtimeCss = readFileSync(
  fileURLToPath(new URL("./settings.vendor-codex-runtime.css", import.meta.url)),
  "utf8",
);

function getCssRuleBlock(css: string, selector: string): string {
  const escapedSelector = selector
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? "";
}

describe("vendor codex runtime card", () => {
  it("uses the shared 5px radius tokens", () => {
    const cardRule = getCssRuleBlock(runtimeCss, ".vendor-codex-runtime-card");
    const badgeRule = getCssRuleBlock(runtimeCss, ".vendor-codex-runtime-card-badge");

    expect(cardRule).toContain("border-radius: 5px;");
    expect(badgeRule).toContain("border-radius: 5px;");
  });
});
