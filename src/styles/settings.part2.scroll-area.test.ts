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
  it("hides the unthemeable native scrollbars on every settings viewport", () => {
    const viewportPaddingRule = getCssRuleBlock(
      settingsCss,
      '.settings-content [data-slot="scroll-area-viewport"]',
    );
    const pageViewportOverflowRule = getCssRuleBlock(
      settingsCss,
      '.settings-content > [data-slot="scroll-area-viewport"]',
    );
    const horizontalOverlayRule = getCssRuleBlock(
      settingsCss,
      '.settings-content > [data-slot="scroll-area-scrollbar"][data-orientation="horizontal"]',
    );
    const providersPaddingRule = getCssRuleBlock(
      settingsCss,
      ".settings-content-wrap:has(> .settings-content--providers)",
    );
    const nativeViewportRule = getCssRuleBlock(
      scrollbarsCss,
      '.settings-content [data-slot="scroll-area-viewport"]',
    );
    const nativeScrollbarRule = getCssRuleBlock(
      scrollbarsCss,
      '.settings-content [data-slot="scroll-area-viewport"]::-webkit-scrollbar',
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
    expect(providersPaddingRule).toContain("--settings-content-pad-bottom: 0px;");
    expect(providersPaddingRule).not.toContain("--settings-content-pad-right");
    // Native scrollbars stay hidden: WKWebView ignores ::-webkit-scrollbar
    // styling and shows white system pills (tauri-apps/tauri#6067); the Radix
    // overlay scrollbar is the only indicator on every platform.
    expect(nativeViewportRule).toContain("scrollbar-width: none;");
    expect(nativeScrollbarRule).toContain("display: none;");
    // The page viewport never scrolls sideways; the horizontal indicator is
    // hidden with it.
    expect(pageViewportOverflowRule).toContain("overflow-x: hidden !important;");
    expect(horizontalOverlayRule).toContain("display: none !important;");
    expect(overlayScrollbarRule).toContain("width: 6px !important;");
    expect(overlayScrollbarRule).toContain("padding: 4px 1px !important;");
    expect(overlayThumbRule).toContain("min-width: 4px;");
  });

  it("hides the redundant outer overlay scrollbars on the providers settings page", () => {
    const overlayScrollbarRule = getCssRuleBlock(
      settingsCss,
      '.settings-content.settings-content--providers > [data-slot="scroll-area-scrollbar"]',
    );
    const overlayCornerRule = getCssRuleBlock(
      settingsCss,
      '.settings-content.settings-content--providers > [data-slot="scroll-area-corner"]',
    );

    expect(overlayScrollbarRule).toContain("display: none !important;");
    expect(overlayCornerRule).toContain("display: none !important;");
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

  it("pins the shortcuts panes to the viewport height instead of a fixed cap", () => {
    const shortcutsPaddingRule = getCssRuleBlock(
      settingsCss,
      ".settings-content-wrap:has(> .settings-content--shortcuts)",
    );
    const shortcutsSectionRule = getCssRuleBlock(
      settingsCss,
      ".settings-shortcuts-section",
    );
    const shortcutsLayoutRule = getCssRuleBlock(
      settingsCss,
      ".settings-shortcuts-layout",
    );
    const shortcutsListRule = getCssRuleBlock(
      settingsCss,
      ".settings-shortcuts-list",
    );

    expect(shortcutsPaddingRule).toContain("--settings-content-pad-top: 8px;");
    expect(shortcutsPaddingRule).toContain(
      "--settings-content-pad-bottom: 16px;",
    );
    expect(shortcutsSectionRule).toContain("height: 100%;");
    expect(shortcutsLayoutRule).toContain("flex: 1 1 auto;");
    expect(shortcutsLayoutRule).toContain("min-height: 0;");
    expect(shortcutsListRule).not.toContain("max-height");
  });
});
