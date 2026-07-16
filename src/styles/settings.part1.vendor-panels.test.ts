import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const vendorPanelsCss = readFileSync(
  fileURLToPath(new URL("./settings.part1.vendor-panels.css", import.meta.url)),
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

describe("vendor settings panel compact layout", () => {
  it("keeps the engine list and icons compact but readable", () => {
    const navRule = getCssRuleBlock(vendorPanelsCss, ".vendor-engine-nav");
    const searchRule = getCssRuleBlock(vendorPanelsCss, ".vendor-engine-search");
    const tabRule = getCssRuleBlock(vendorPanelsCss, ".vendor-engine-tab");
    const iconRule = getCssRuleBlock(vendorPanelsCss, ".vendor-engine-icon");
    const panelRule = getCssRuleBlock(vendorPanelsCss, ".vendor-settings-panel");
    const contentRule = getCssRuleBlock(
      vendorPanelsCss,
      ".vendor-settings-content",
    );
    const mobileContentRule = vendorPanelsCss.match(
      /@media \(max-width: 900px\)[\s\S]*?\.vendor-settings-content\s*\{([^}]*)\}/,
    )?.[1] ?? "";
    const headingRule = getCssRuleBlock(vendorPanelsCss, ".vendor-section-heading");
    const tabContentRule = getCssRuleBlock(vendorPanelsCss, ".vendor-tab-content");
    const providerListRule = getCssRuleBlock(vendorPanelsCss, ".vendor-provider-list");
    const officialSectionRule = getCssRuleBlock(
      vendorPanelsCss,
      ".vendor-provider-list > .vendor-provider-list",
    );
    const thirdPartyHeaderRule = getCssRuleBlock(
      vendorPanelsCss,
      ".vendor-provider-list > .vendor-provider-list + .vendor-list-header",
    );
    const thirdPartyTableRule = getCssRuleBlock(
      vendorPanelsCss,
      ".vendor-provider-list > .vendor-list-header + .vendor-provider-table-stack",
    );
    const listHeaderRule = getCssRuleBlock(vendorPanelsCss, ".vendor-list-header");
    const frameRule = getCssRuleBlock(
      vendorPanelsCss,
      ".vendor-provider-table-frame",
    );
    const stackRule = getCssRuleBlock(
      vendorPanelsCss,
      ".vendor-provider-table-stack",
    );
    const emptyFrameRule = getCssRuleBlock(
      vendorPanelsCss,
      '.vendor-provider-table-frame[data-empty="true"]',
    );
    const emptyAdjacentRule = getCssRuleBlock(
      vendorPanelsCss,
      '.vendor-provider-table-frame[data-empty="true"] + .vendor-empty',
    );
    const emptyRule = getCssRuleBlock(vendorPanelsCss, ".vendor-empty");
    const buttonRule = getCssRuleBlock(
      vendorPanelsCss,
      ".vendor-settings-panel [data-slot=\"button\"]",
    );
    const badgeRule = getCssRuleBlock(
      vendorPanelsCss,
      ".vendor-settings-panel [data-slot=\"badge\"]",
    );
    const logoRule = getCssRuleBlock(vendorPanelsCss, ".vendor-cli-logo-img");
    const brandTitleRule = getCssRuleBlock(vendorPanelsCss, ".vendor-brand-title");
    const monoLogoRule = getCssRuleBlock(
      vendorPanelsCss,
      ".vendor-cli-logo-img-mono",
    );
    const iflowLogoRule = getCssRuleBlock(
      vendorPanelsCss,
      ".vendor-cli-logo-iflow",
    );

    expect(navRule).toContain("width: 200px;");
    expect(navRule).toContain("height: 100%;");
    expect(navRule).toContain("min-height: 0;");
    expect(navRule).toContain("padding: 16px 10px 0;");
    expect(vendorPanelsCss).not.toContain("scrollbar-gutter: stable;");
    expect(searchRule).toContain("min-height: 32px;");
    expect(searchRule).toContain("margin-bottom: 10px;");
    expect(searchRule).toContain("border-radius: 8px;");
    expect(tabRule).toContain("min-height: 36px;");
    expect(tabRule).toContain("font-size: 13px;");
    expect(tabRule).toContain("gap: 7px;");
    expect(panelRule).toContain("height: 100%;");
    expect(panelRule).toContain("min-height: 0;");
    expect(contentRule).toContain("height: 100%;");
    expect(contentRule).toContain("min-height: 0;");
    expect(contentRule).toContain("padding-left: 24px;");
    expect(contentRule).toContain("padding-right: 24px;");
    expect(mobileContentRule).toContain("padding-left: 0;");
    expect(mobileContentRule).toContain("padding-right: 0;");
    expect(contentRule).toContain(
      "border-left: 1px solid var(--settings-basic-border);",
    );
    expect(headingRule).toContain("gap: 24px;");
    expect(headingRule).toContain("margin-bottom: 28px;");
    expect(tabContentRule).toContain("min-height: 100%;");
    expect(tabContentRule).toContain("gap: 16px;");
    expect(providerListRule).toContain("gap: 0;");
    expect(officialSectionRule).toContain("gap: 8px;");
    expect(thirdPartyHeaderRule).toContain("margin-top: 20px;");
    expect(thirdPartyTableRule).toContain("margin-top: 10px;");
    expect(listHeaderRule).toContain("gap: 20px;");
    expect(stackRule).toContain("flex-direction: column;");
    expect(frameRule).toContain("border-radius: 5px;");
    expect(emptyFrameRule).toContain("border-bottom: 0;");
    expect(emptyFrameRule).toContain("border-bottom-right-radius: 0;");
    expect(emptyRule).toContain("border: 1px solid var(--border-muted);");
    expect(emptyAdjacentRule).toContain("border-top: 0;");
    expect(emptyAdjacentRule).toContain("border-top-left-radius: 0;");
    expect(buttonRule).toContain("border-radius: 5px;");
    expect(badgeRule).toContain("border-radius: 5px;");
    expect(iconRule).toContain("width: 28px;");
    expect(iconRule).toContain("height: 28px;");
    expect(iconRule).toContain("border-radius: 5px;");
    expect(logoRule).toContain("width: 15px;");
    expect(logoRule).toContain("height: 15px;");
    expect(brandTitleRule).toContain("font-weight: 400;");
    expect(monoLogoRule).toContain("filter: grayscale(1) brightness(0);");
    expect(iflowLogoRule).not.toContain("linear-gradient");
  });
});
