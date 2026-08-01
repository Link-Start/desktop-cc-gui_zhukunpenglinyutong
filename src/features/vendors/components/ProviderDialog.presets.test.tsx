// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CLAUDE_PROVIDER_PRESETS } from "../types";
import { ProviderDialog } from "./ProviderDialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("ProviderDialog preset shortcuts", () => {
  it("renders the official direct button plus an icon for each proxy preset", () => {
    const { container } = render(
      <ProviderDialog isOpen provider={null} onClose={vi.fn()} onSave={vi.fn()} />,
    );

    const presetButtons = container.querySelectorAll(".vendor-preset-btn");
    // 官方直连 1 个 + 第三方/代理预设(含 custom)
    expect(presetButtons).toHaveLength(CLAUDE_PROVIDER_PRESETS.length + 1);

    const officialButton = presetButtons[0];
    const officialImg = officialButton.querySelector("img");
    expect(officialImg).toBeTruthy();
    expect(
      decodeURIComponent(officialImg?.getAttribute("src") ?? ""),
    ).toContain("<title>Anthropic</title>");
    // 添加模式默认选中官方直连
    expect(officialButton.className).toContain("active");

    // 代理区第一个是 custom,使用 lucide 图标而非品牌图
    const customButton = presetButtons[1];
    expect(customButton.querySelector("svg")).toBeTruthy();
    expect(customButton.querySelector("img")).toBeNull();

    const expectedBrandTitles = [
      "Zhipu",
      "Kimi",
      "Kimi",
      "DeepSeek",
      "Minimax",
      "XiaomiMiMo",
      "XiaomiMiMo",
      "BaiLian",
      "BaiLian",
      "LongCat",
      "opencode",
      "OpenRouter",
    ];

    const proxyBrandButtons = Array.from(presetButtons).slice(2);
    expect(proxyBrandButtons).toHaveLength(expectedBrandTitles.length);
    proxyBrandButtons.forEach((button, index) => {
      const img = button.querySelector("img");
      expect(img).toBeTruthy();
      const decodedSrc = decodeURIComponent(img?.getAttribute("src") ?? "");
      expect(decodedSrc).toContain(`<title>${expectedBrandTitles[index]}</title>`);
      // 白色主体字形的品牌(当前仅 kimi)需深色底衬瓦片,其余品牌不需要
      const isKimi = expectedBrandTitles[index] === "Kimi";
      expect(img?.className.includes("vendor-brand-icon-tile")).toBe(isKimi);
    });
  });

  it("locks the api url in official direct mode and warns for proxy urls", () => {
    const { container } = render(
      <ProviderDialog isOpen provider={null} onClose={vi.fn()} onSave={vi.fn()} />,
    );

    const apiUrlInput = container.querySelector<HTMLInputElement>(
      "input[placeholder='settings.vendor.dialog.apiUrlPlaceholder']",
    );
    expect(apiUrlInput?.readOnly).toBe(true);
    expect(apiUrlInput?.value).toBe("https://api.anthropic.com");
  });
});
