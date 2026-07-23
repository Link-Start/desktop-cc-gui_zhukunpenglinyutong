import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("MessagesAnchorRail styles", () => {
  it("hides the anchor rail from the conversation container width", () => {
    const shellCss = readFileSync(
      resolve(process.cwd(), "src/styles/messages.part1-shell.css"),
      "utf8",
    );
    const statusCss = readFileSync(
      resolve(process.cwd(), "src/styles/messages.status-shell.css"),
      "utf8",
    );

    expect(shellCss).toMatch(/\.messages-shell\s*\{[\s\S]*container-type:\s*inline-size;/);
    expect(statusCss).toMatch(
      /@container\s*\(max-width:\s*960px\)\s*\{[\s\S]*\.messages-anchor-rail\s*\{[\s\S]*display:\s*none;/,
    );
  });
});
