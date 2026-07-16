import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const settingsCss = readFileSync(
  fileURLToPath(new URL("./settings.part2.css", import.meta.url)),
  "utf8",
);
const scrollbarsCss = readFileSync(
  fileURLToPath(new URL("./scrollbars.css", import.meta.url)),
  "utf8",
);

function getCssRuleBlock(css: string, selector: string): string {
  const escapedSelector = selector
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? "";
}

describe("settings scroll area contract", () => {
  it("keeps the settings viewport scrollbar thin and close to the content edge", () => {
    const viewportPaddingRule = getCssRuleBlock(
      settingsCss,
      '.settings-content [data-slot="scroll-area-viewport"]',
    );
    const providersPaddingRule = getCssRuleBlock(
      settingsCss,
      ".settings-content.settings-content--providers",
    );
    const nativeScrollbarRule = getCssRuleBlock(
      scrollbarsCss,
      '.settings-content [data-slot="scroll-area-viewport"]::-webkit-scrollbar',
    );
    const nativeThumbRule = getCssRuleBlock(
      scrollbarsCss,
      '.settings-content [data-slot="scroll-area-viewport"]::-webkit-scrollbar-thumb',
    );
    const overlayScrollbarRule = getCssRuleBlock(
      settingsCss,
      '.settings-content > [data-slot="scroll-area-scrollbar"][data-orientation="vertical"]',
    );
    const overlayThumbRule = getCssRuleBlock(
      settingsCss,
      '.settings-content > [data-slot="scroll-area-scrollbar"][data-orientation="vertical"] [data-slot="scroll-area-thumb"]',
    );

    expect(viewportPaddingRule).toContain(
      "padding: var(--settings-content-pad-top) var(--settings-content-pad-right)",
    );
    expect(settingsCss).toContain("--settings-content-pad-right: 12px;");
    expect(providersPaddingRule).toContain("--settings-content-pad-top: 0px;");
    expect(providersPaddingRule).toContain("--settings-content-pad-right: 0px;");
    expect(providersPaddingRule).toContain("--settings-content-pad-bottom: 0px;");
    expect(overlayScrollbarRule).toContain("width: 6px !important;");
    expect(overlayScrollbarRule).toContain("padding: 4px 1px !important;");
    expect(overlayThumbRule).toContain("min-width: 4px;");
    expect(nativeScrollbarRule).toContain("width: var(--sb-size);");
    expect(nativeThumbRule).toContain("border-width: var(--sb-thumb-inset);");
    expect(nativeThumbRule).toContain("background-clip: content-box;");
  });

  it("hides the redundant outer scrollbars on the providers settings page", () => {
    const overlayScrollbarRule = getCssRuleBlock(
      settingsCss,
      '.settings-content.settings-content--providers > [data-slot="scroll-area-scrollbar"]',
    );
    const overlayCornerRule = getCssRuleBlock(
      settingsCss,
      '.settings-content.settings-content--providers > [data-slot="scroll-area-corner"]',
    );
    const nativeViewportRule = getCssRuleBlock(
      scrollbarsCss,
      '.settings-content.settings-content--providers [data-slot="scroll-area-viewport"]',
    );
    const nativeScrollbarRule = getCssRuleBlock(
      scrollbarsCss,
      '.settings-content.settings-content--providers [data-slot="scroll-area-viewport"]::-webkit-scrollbar',
    );

    expect(overlayScrollbarRule).toContain("display: none !important;");
    expect(overlayCornerRule).toContain("display: none !important;");
    expect(nativeViewportRule).toContain("scrollbar-width: none;");
    expect(nativeViewportRule).toContain(
      "scrollbar-color: transparent transparent;",
    );
    expect(nativeScrollbarRule).toContain("display: none;");
  });

  it("keeps the scroll-area viewport wrapper full-height so nested full-height panels can scroll", () => {
    const viewportWrapperRule = getCssRuleBlock(
      settingsCss,
      '.settings-content [data-slot="scroll-area-viewport"] > div',
    );

    expect(viewportWrapperRule).toContain("display: block !important;");
    expect(viewportWrapperRule).toContain("height: 100% !important;");
    expect(viewportWrapperRule).toContain("width: 100% !important;");
    expect(viewportWrapperRule).toContain("max-width: 100% !important;");
  });
});
