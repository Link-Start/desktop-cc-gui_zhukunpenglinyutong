import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const terminalCss = readFileSync(
  fileURLToPath(new URL("./terminal.css", import.meta.url)),
  "utf8",
);

describe("terminal panel tabs", () => {
  it("keeps the collapse toggle as a flat tab bar cell", () => {
    expect(terminalCss).toMatch(
      /\.terminal-header\s*\{[^}]*min-height:\s*34px/s,
    );
    expect(terminalCss).toMatch(
      /\.terminal-panel-toggle\s*\{[^}]*min-height:\s*34px/s,
    );
    expect(terminalCss).toMatch(
      /\.terminal-panel-toggle\s*\{[^}]*border-radius:\s*0/s,
    );
    expect(terminalCss).toMatch(
      /\.terminal-panel-toggle\s*\{[^}]*border-right:\s*1px solid var\(--border-subtle\)/s,
    );
    expect(terminalCss).toMatch(
      /\.terminal-tab\s*\{[^}]*min-height:\s*34px/s,
    );
  });
});
