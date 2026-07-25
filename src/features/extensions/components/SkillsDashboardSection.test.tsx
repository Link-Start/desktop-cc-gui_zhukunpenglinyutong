/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SkillsDashboardSection } from "./SkillsDashboardSection";

const mocks = vi.hoisted(() => ({
  language: "en" as string,
}));

// 懒加载边界：用 stub 替换整个 skills chunk，避免在单测里拉起 vendored 树
// （motion / @base-ui / copy 字典等整条依赖链）。
vi.mock("./TokenTrackerSkillsView", () => ({
  default: () => <div data-testid="tt-skills-stub" />,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: mocks.language },
  }),
}));

describe("SkillsDashboardSection", () => {
  beforeEach(() => {
    mocks.language = "en";
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it("renders the skills page directly without any tokentracker-cli gate", async () => {
    // skills 后端内置（skills_hub.rs），无 Tauri CLI detect/ensure 链路；
    // 这里不 mock @/services/tauri —— 组件若误用会直接报错。
    render(<SkillsDashboardSection />);

    expect(await screen.findByTestId("tt-skills-stub")).toBeTruthy();
  });

  it("syncs locale/theme bridge storage before mounting the vendored page", async () => {
    mocks.language = "zh";
    document.documentElement.dataset.theme = "dark";

    render(<SkillsDashboardSection />);

    expect(await screen.findByTestId("tt-skills-stub")).toBeTruthy();
    expect(localStorage.getItem("tokentracker-locale")).toBe("zh-CN");
    expect(localStorage.getItem("tokentracker-theme")).toBe("dark");
  });

  it("maps unsupported app languages to the en vendored locale", async () => {
    mocks.language = "fr";

    render(<SkillsDashboardSection />);

    expect(await screen.findByTestId("tt-skills-stub")).toBeTruthy();
    expect(localStorage.getItem("tokentracker-locale")).toBe("en");
    expect(localStorage.getItem("tokentracker-theme")).toBe("system");
  });
});
