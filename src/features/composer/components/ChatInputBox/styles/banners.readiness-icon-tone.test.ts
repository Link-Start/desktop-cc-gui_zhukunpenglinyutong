import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("composer readiness icon tone", () => {
  it("keeps engine glyphs neutral, not button-primary blue", () => {
    const bannersCss = readFileSync(
      resolve(
        process.cwd(),
        "src/features/composer/components/ChatInputBox/styles/banners.css",
      ),
      "utf8",
    );

    const iconRule = bannersCss.match(
      /\.composer-readiness-icon\s*\{[^}]*\}/,
    )?.[0];
    expect(iconRule).toBeTruthy();
    // EngineIcon (Codex/Grok) fills with currentColor — primary blue makes the
    // bottom trigger diverge from the monochrome glyph in the model picker.
    expect(iconRule).not.toContain("--button-primary");
    expect(iconRule).toMatch(/color\s*:\s*var\(--text-primary\)/);
  });
});
