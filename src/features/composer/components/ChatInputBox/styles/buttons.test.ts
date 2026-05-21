import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const buttonsCss = readFileSync(
  fileURLToPath(new URL("./buttons.css", import.meta.url)),
  "utf8",
);

describe("chat input button styles", () => {
  it("keeps the streaming stop button smaller and circular", () => {
    expect(buttonsCss).toMatch(/\.stop-button\s*\{[^}]*width:\s*24px/s);
    expect(buttonsCss).toMatch(/\.stop-button\s*\{[^}]*height:\s*24px/s);
    expect(buttonsCss).toMatch(/\.stop-button\s*\{[^}]*aspect-ratio:\s*1 \/ 1/s);
    expect(buttonsCss).toMatch(/\.stop-button\s*\{[^}]*border-radius:\s*999px/s);
    expect(buttonsCss).not.toMatch(/\.stop-button\s*\{[^}]*clip-path:/s);
    expect(buttonsCss).not.toMatch(/\.stop-button\s*\{[^}]*overflow:\s*hidden/s);
    expect(buttonsCss).toMatch(
      /\.stop-button\s*\{[^}]*url\('\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/assets\/icon\.png'\) center \/ 136% 136% no-repeat/s,
    );
    expect(buttonsCss).toMatch(
      /\.submit-button\.stop-button:hover:not\(:disabled\)\s*\{[^}]*url\([^}]*136% 136% no-repeat/s,
    );
    expect(buttonsCss).toMatch(/\.stop-button \.codicon\s*\{[^}]*opacity:\s*0/s);
  });

  it("keeps the ingress halo scaled to the smaller stop button", () => {
    expect(buttonsCss).toMatch(
      /\.stop-button\.is-ingress::before\s*\{[^}]*inset:\s*-5px/s,
    );
    expect(buttonsCss).not.toMatch(
      /\.stop-button\.is-ingress::before\s*\{[^}]*inset:\s*-3px/s,
    );
    expect(buttonsCss).toContain("0 -12px 0");
  });
});
