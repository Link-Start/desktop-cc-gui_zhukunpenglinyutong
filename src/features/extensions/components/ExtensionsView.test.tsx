/** @vitest-environment jsdom */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import enSidebar from "@/i18n/locales/en/sidebar";
import zhSidebar from "@/i18n/locales/zh/sidebar";
import { ExtensionsView } from "./ExtensionsView";

const translations = vi.hoisted(
  (): Record<string, string> => ({
  "extensions.title": "Extensions",
  "extensions.sectionsLabel": "Usage and framework",
  "extensions.tabs.usage": "Usage",
  "extensions.tabs.framework": "AI Framework",
  "extensions.tabs.skills": "Skills",
  "extensions.tabs.mcps": "Mcps",
  "extensions.tabs.plugins": "Plugins",
  "extensions.tabs.hooks": "Hooks",
  "extensions.tabs.rules": "Rules",
  "extensions.tabs.commands": "Commands",
  "extensions.tabs.subagents": "Subagents",
  "extensions.panelTitles.usage": "Usage",
  "extensions.panelTitles.framework": "AI Framework",
  "extensions.panelTitles.skills": "Extend your CLI with Skills",
  "extensions.panelTitles.hooks": "Extend your CLI with Hooks",
  "extensions.descriptions.usage": "Coming soon",
  "extensions.descriptions.skills": "Coming soon",
  "extensions.descriptions.hooks": "Coming soon",
  }),
);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => translations[key] ?? key,
  }),
}));

describe("ExtensionsView", () => {
  it("renders the section pills and extension tabs in the requested order", () => {
    render(<ExtensionsView />);

    const sectionGroup = screen.getByRole("group", { name: "Usage and framework" });
    expect(
      within(sectionGroup).getAllByRole("button").map((button) => button.textContent),
    ).toEqual(["Usage", "AI Framework"]);
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByText("Browse Marketplace")).toBeNull();

    const filterRow = sectionGroup.parentElement;
    expect(filterRow).toBeTruthy();
    const tabButtons = within(filterRow as HTMLElement)
      .getAllByRole("button")
      .filter((button) => !sectionGroup.contains(button));
    expect(
      tabButtons.map((button) => button.textContent),
    ).toEqual(["Skills", "Mcps", "Plugins", "Hooks", "Rules", "Commands", "Subagents"]);
  });

  it("gives section pills an icon but keeps extension tabs icon-less", () => {
    render(<ExtensionsView />);

    const sectionGroup = screen.getByRole("group", { name: "Usage and framework" });
    for (const button of within(sectionGroup).getAllByRole("button")) {
      expect(button.querySelector("svg")).toBeTruthy();
    }
    expect(screen.getByRole("button", { name: "Skills" }).querySelector("svg")).toBeNull();
    expect(screen.getByRole("button", { name: "Subagents" }).querySelector("svg")).toBeNull();
  });

  it("defaults to the usage section when the page opens", () => {
    render(<ExtensionsView />);

    expect(screen.getByRole("button", { name: "Usage" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Skills" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("heading", { name: "Usage" })).toBeTruthy();
    expect(screen.getByText("Coming soon")).toBeTruthy();
  });

  it("updates the introduction panel when a tab is selected", () => {
    render(<ExtensionsView />);

    fireEvent.click(screen.getByRole("button", { name: "Hooks" }));

    expect(screen.getByRole("heading", { name: "Extend your CLI with Hooks" })).toBeTruthy();
    expect(screen.getByText("Coming soon")).toBeTruthy();
  });

  it("renders a structured shadcn-style empty state", () => {
    render(<ExtensionsView />);

    const panel = screen.getByRole("heading", { name: "Usage" }).closest(".extensions-empty-panel");
    expect(panel).toBeTruthy();
    expect(panel?.querySelector(".extensions-empty-panel-icon svg")).toBeTruthy();
    expect(panel?.querySelectorAll(".extensions-empty-panel-preview span")).toHaveLength(4);
  });

  it("keeps zh and en locale keys aligned for every tab", () => {
    for (const locale of [enSidebar, zhSidebar]) {
      expect(Object.keys(locale.extensions.tabs).sort()).toEqual(
        ["commands", "framework", "hooks", "mcps", "plugins", "rules", "skills", "subagents", "usage"],
      );
      expect(Object.keys(locale.extensions.panelTitles).sort()).toEqual(
        Object.keys(locale.extensions.tabs).sort(),
      );
      expect(Object.keys(locale.extensions.descriptions).sort()).toEqual(
        Object.keys(locale.extensions.tabs).sort(),
      );
    }
  });

  it("does not render empty state action buttons", () => {
    render(<ExtensionsView />);

    expect(screen.getByRole("button", { name: "Skills" }).dataset.size).toBe("sm");
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Documentation" })).toBeNull();
  });

  it("keeps tab button dimensions stable across active state changes", () => {
    render(<ExtensionsView />);

    for (const name of ["Usage", "AI Framework", "Skills", "Subagents"]) {
      expect(screen.getByRole("button", { name }).classList.contains("extensions-filter-tab")).toBe(true);
    }
  });

  it("keeps the top search surface hidden", () => {
    render(<ExtensionsView />);

    expect(screen.queryByLabelText("Search extensions")).toBeNull();
    expect(screen.queryByPlaceholderText(/Search/)).toBeNull();
  });
});
