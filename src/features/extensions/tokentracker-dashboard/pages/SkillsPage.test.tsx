/** @vitest-environment jsdom */
// Vendored from upstream src/pages/SkillsPage.test.jsx (renamed to .tsx to
// match the repo vitest include pattern; jsdom docblock added for the repo's
// node-default environment).
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { copy } from "../lib/copy";
import {
  addSkillRepo,
  deleteLocalSkill,
  discoverSkills,
  getInstalledSkills,
  getSkillRepos,
  importLocalSkill,
  installSkill,
  removeSkillRepo,
  restoreSkill,
  searchSkills,
  setSkillTargets,
  uninstallSkill,
} from "../lib/skills-api";
// 经 @/ alias 引入，命中 tokentracker-dashboard-modules.d.ts 的模块声明
//（declare module 不支持相对 specifier）。
import { SkillsPage } from "@/features/extensions/tokentracker-dashboard/pages/SkillsPage.jsx";

vi.mock("../lib/skills-api", () => ({
  addSkillRepo: vi.fn(),
  deleteLocalSkill: vi.fn(),
  discoverSkills: vi.fn(),
  getInstalledSkills: vi.fn(),
  getSkillRepos: vi.fn(),
  importLocalSkill: vi.fn(),
  installSkill: vi.fn(),
  removeSkillRepo: vi.fn(),
  restoreSkill: vi.fn(),
  searchSkills: vi.fn(),
  setSkillTargets: vi.fn(),
  uninstallSkill: vi.fn(),
}));

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  vi.mocked(getInstalledSkills).mockResolvedValue({
    targets: [
      { id: "claude", label: "Claude" },
      { id: "grok", label: "Grok" },
      { id: "antigravity", label: "Antigravity" },
    ],
    skills: [
      {
        id: "alpha-skill",
        name: "Alpha Skill",
        directory: "alpha-skill",
        description: "First installed skill.",
        targets: ["claude", "grok", "antigravity"],
        managed: true,
      },
      {
        id: "beta-skill",
        name: "Beta Skill",
        directory: "beta-skill",
        description: "Second installed skill.",
        targets: ["claude"],
        managed: true,
      },
    ],
  });
  vi.mocked(getSkillRepos).mockResolvedValue({ repos: [] });
  vi.mocked(discoverSkills).mockResolvedValue({ skills: [] });
  vi.mocked(searchSkills).mockResolvedValue({ skills: [] });
  vi.mocked(installSkill).mockResolvedValue({ ok: true });
  vi.mocked(uninstallSkill).mockResolvedValue({ ok: true });
  vi.mocked(restoreSkill).mockResolvedValue({ ok: true });
  vi.mocked(setSkillTargets).mockResolvedValue({ ok: true });
  vi.mocked(importLocalSkill).mockResolvedValue({ ok: true });
  vi.mocked(deleteLocalSkill).mockResolvedValue({ ok: true });
  vi.mocked(addSkillRepo).mockResolvedValue({ ok: true });
  vi.mocked(removeSkillRepo).mockResolvedValue({ ok: true });
});

function makeSkill(index: number) {
  return {
    id: `skill-${index}`,
    name: `Skill ${index}`,
    directory: `skill-${index}`,
    description: `Installed skill ${index}.`,
    targets: ["claude"],
    managed: true,
  };
}

describe("SkillsPage", () => {
  it("renders installed skills instead of the empty state", async () => {
    render(<SkillsPage />);

    expect(await screen.findByText("Alpha Skill")).toBeTruthy();
    expect(screen.getByText("Beta Skill")).toBeTruthy();
    expect(screen.getByText("First installed skill.")).toBeTruthy();
    expect(
      screen.getByRole("searchbox", { name: copy("skills.action.search_aria") }),
    ).toBeTruthy();

    await waitFor(() => {
      expect(screen.queryByText(copy("skills.empty.my"))).toBeNull();
    });
  });

  it("filters the My tab list client-side by search query", async () => {
    const user = userEvent.setup();
    render(<SkillsPage />);

    expect(await screen.findByText("Alpha Skill")).toBeTruthy();
    expect(screen.getByText("Beta Skill")).toBeTruthy();

    const searchInput = screen.getByRole("searchbox", {
      name: copy("skills.action.search_aria"),
    });
    await user.type(searchInput, "alpha");

    await waitFor(() => {
      expect(screen.getByText("Alpha Skill")).toBeTruthy();
      expect(screen.queryByText("Beta Skill")).toBeNull();
    });
    expect(searchSkills).not.toHaveBeenCalled();
  });

  it("clears My tab search when clear search is clicked", async () => {
    const user = userEvent.setup();
    render(<SkillsPage />);

    expect(await screen.findByText("Alpha Skill")).toBeTruthy();

    const searchInput = screen.getByRole("searchbox", {
      name: copy("skills.action.search_aria"),
    });
    await user.type(searchInput, "alpha");

    await waitFor(() => {
      expect(screen.queryByText("Beta Skill")).toBeNull();
    });

    await user.click(screen.getByRole("button", { name: copy("skills.action.search_clear") }));

    await waitFor(() => {
      expect(screen.getByText("Beta Skill")).toBeTruthy();
      expect((searchInput as HTMLInputElement).value).toBe("");
    });
  });

  it("does not mark an unrelated browse skill installed when only the nested local leaf matches", async () => {
    const user = userEvent.setup();
    vi.mocked(getInstalledSkills).mockResolvedValue({
      targets: [
        { id: "claude", label: "Claude" },
        { id: "codex", label: "Codex" },
      ],
      skills: [
        {
          id: "local:apple/apple-notes",
          name: "Local Apple Notes",
          directory: "apple/apple-notes",
          description: "Nested local skill.",
          targets: ["claude"],
          managed: true,
        },
      ],
    });
    vi.mocked(getSkillRepos).mockResolvedValue({
      repos: [{ owner: "someone", name: "unrelated-skills", branch: "main", enabled: true }],
    });
    vi.mocked(discoverSkills).mockResolvedValue({
      skills: [
        {
          key: "someone/unrelated-skills:apple-notes",
          name: "Remote Apple Notes",
          directory: "apple-notes",
          description: "Different remote skill with the same leaf name.",
          repoOwner: "someone",
          repoName: "unrelated-skills",
          repoBranch: "main",
        },
      ],
    });

    render(<SkillsPage />);

    expect(await screen.findByText("Local Apple Notes")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: copy("skills.tab.browse") }));

    expect(await screen.findByText("Remote Apple Notes")).toBeTruthy();
    expect(screen.getByRole("button", { name: copy("skills.action.install") })).toBeTruthy();
    expect(screen.queryByRole("button", { name: copy("skills.card.manage") })).toBeNull();
  });

  it("keeps bulk actions sticky when a skill is selected", async () => {
    const user = userEvent.setup();
    render(<SkillsPage />);

    await user.click(await screen.findByRole("checkbox", { name: copy("skills.select.row_aria", { name: "Alpha Skill" }) }));

    const toolbar = screen.getByRole("toolbar", { name: copy("skills.select.toolbar_aria") });
    expect(toolbar.closest(".extensions-skills-sticky-actions")).toBeTruthy();
    const bulkRemoveButton = screen.getByRole("button", { name: copy("skills.select.bulk_remove") });
    expect(bulkRemoveButton.className).toContain("border-red-200");
    expect(bulkRemoveButton.className).toContain("text-red-700");
  });

  it("windows long installed skill lists", async () => {
    vi.mocked(getInstalledSkills).mockResolvedValue({
      targets: [{ id: "claude", label: "Claude" }],
      skills: Array.from({ length: 140 }, (_, index) => makeSkill(index + 1)),
    });

    const { container } = render(<SkillsPage />);

    expect(await screen.findByText("Skill 1")).toBeTruthy();
    await waitFor(() => {
      const list = container.querySelector('[data-virtualized="true"]');
      expect(list).toBeTruthy();
      expect(container.querySelectorAll('[data-skill-row="1"]').length).toBeLessThan(80);
    });
  });
});
