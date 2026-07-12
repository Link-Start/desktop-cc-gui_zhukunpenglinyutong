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

  it("draws a single divider above the tab bar", () => {
    // The resizer already renders the divider above the tabs; a header
    // border-top would stack a second line 6px away and look off.
    expect(terminalCss).not.toMatch(/\.terminal-header\s*\{[^}]*border-top/s);
  });
});

describe("terminal panel theming", () => {
  it("follows the app theme instead of hardcoding a dark palette", () => {
    expect(terminalCss).toMatch(
      /--terminal-background:\s*var\(--theme-terminal-background,\s*var\(--surface-debug\)\)/,
    );
    expect(terminalCss).toMatch(
      /--terminal-foreground:\s*var\(--theme-terminal-foreground,\s*var\(--text-stronger\)\)/,
    );
    // No hardcoded dark hex leaking through in light mode.
    expect(terminalCss).not.toMatch(/#11151b/);
    expect(terminalCss).not.toMatch(/rgba\(255,\s*255,\s*255,\s*0\.08\)/);
  });

  it("stays inside the main content column so the file panel is not covered", () => {
    expect(terminalCss).toMatch(/\.terminal-panel\s*\{[^}]*grid-column:\s*1;/s);
    expect(terminalCss).not.toMatch(
      /\.terminal-panel\s*\{[^}]*grid-column:\s*1 \/ -1/s,
    );
  });

  it("hides the xterm scrollbar gutter so no bright bar shows in dark mode", () => {
    // xterm's viewport is overflow-y: scroll (always-on); a transparent track
    // lets the terminal background show through instead of a light gutter.
    expect(terminalCss).toMatch(
      /\.xterm-viewport::-webkit-scrollbar-track\s*\{[^}]*background:\s*transparent/s,
    );
  });
});
