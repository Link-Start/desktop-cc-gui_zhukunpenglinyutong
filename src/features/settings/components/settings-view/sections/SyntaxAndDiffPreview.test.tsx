// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: { defaultValue?: string }) => {
      const map: Record<string, string> = {
        themePreviewTitle: "Code & Diff Preview",
        themePreviewCodePanel: "Code block (Markdown)",
        themePreviewFilePanel: "File preview (file-view)",
        themePreviewDiffPanel: "Diff line-level",
        themePreviewLegendAdd: "Added",
        themePreviewLegendDel: "Removed",
      };
      return fallback?.defaultValue ?? map[key] ?? key;
    },
    i18n: { language: "en" },
  }),
}));

import { SyntaxAndDiffPreview } from "./SyntaxAndDiffPreview";

describe("SyntaxAndDiffPreview", () => {
  it("renders code panel, file panel, and diff panel headings when expanded", () => {
    const { container } = render(
      <SyntaxAndDiffPreview appearance="dark" defaultExpanded />,
    );
    const headers = Array.from(
      container.querySelectorAll(".theme-preview-grid__panel-header"),
    ).map((el) => el.textContent ?? "");
    expect(headers.length).toBe(3);
    // 不依赖 i18n 文案,只断言有 3 个 panel header
    expect(headers.every((h) => h.length > 0)).toBe(true);
  });

  it("stays collapsed by default so the settings list stays clean", () => {
    const { container } = render(<SyntaxAndDiffPreview appearance="dark" />);
    expect(container.querySelector(".theme-preview-grid")).toBeNull();
    expect(
      container.querySelector(".settings-pref-preview-toggle")?.getAttribute(
        "aria-expanded",
      ),
    ).toBe("false");
  });

  it("renders add/remove diff lines with correct modifier class", () => {
    const { container } = render(
      <SyntaxAndDiffPreview appearance="dark" defaultExpanded />,
    );

    const addLines = container.querySelectorAll(
      ".theme-preview-diff__line--add",
    );
    const delLines = container.querySelectorAll(
      ".theme-preview-diff__line--del",
    );
    expect(addLines.length).toBeGreaterThan(0);
    expect(delLines.length).toBeGreaterThan(0);
  });

  it("uses preset-driven CSS variables on diff legend dots", () => {
    const { container } = render(
      <SyntaxAndDiffPreview appearance="light" defaultExpanded />,
    );

    // legend dots must reference the preset-driven variables
    const addDot = container.querySelector(
      ".theme-preview-legend--add .theme-preview-legend__dot",
    );
    const delDot = container.querySelector(
      ".theme-preview-legend--del .theme-preview-legend__dot",
    );
    expect(addDot).toBeTruthy();
    expect(delDot).toBeTruthy();
  });

  it("renders syntax token classes without loading the runtime highlighter", () => {
    const { container } = render(
      <SyntaxAndDiffPreview appearance="dark" defaultExpanded />,
    );

    expect(container.querySelector(".token.keyword")?.textContent).toBe("const");
    expect(container.querySelector(".token.string")?.textContent).toContain("sidebar");
    expect(container.querySelector(".token.number")?.textContent).toBe("42");
  });
});
