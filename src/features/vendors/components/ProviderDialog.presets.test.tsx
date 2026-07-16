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
  it("renders an icon for each preset button", () => {
    const { container } = render(
      <ProviderDialog isOpen provider={null} onClose={vi.fn()} onSave={vi.fn()} />,
    );

    const presetButtons = container.querySelectorAll(".vendor-preset-btn");
    expect(presetButtons).toHaveLength(CLAUDE_PROVIDER_PRESETS.length);

    const expectedBrandTitles = [
      "Zhipu",
      "Moonshot",
      "DeepSeek",
      "MiniMax",
      "Xiaomi MiMo",
      "Qwen",
      "OpenRouter",
    ];

    presetButtons.forEach((button, index) => {
      const iconWrap = button.querySelector(".vendor-preset-btn-icon");
      expect(iconWrap).toBeTruthy();

      if (index === 0) {
        expect(button.querySelector("svg")).toBeTruthy();
        expect(button.querySelector("img")).toBeNull();
        return;
      }

      const img = button.querySelector("img");
      expect(img).toBeTruthy();
      const decodedSrc = decodeURIComponent(img?.getAttribute("src") ?? "");
      expect(decodedSrc).toContain(`<title>${expectedBrandTitles[index - 1]}</title>`);
    });
  });
});
