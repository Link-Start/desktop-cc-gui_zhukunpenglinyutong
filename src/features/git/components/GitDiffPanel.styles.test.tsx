/** @vitest-environment jsdom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const styleBoundaryState = vi.hoisted(() => ({ ready: false }));
const mockUseFeatureStylesReady = vi.hoisted(() =>
  vi.fn(() => styleBoundaryState.ready),
);

vi.mock("../../../styles/useFeatureStylesReady", () => ({
  useFeatureStylesReady: mockUseFeatureStylesReady,
}));

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => undefined },
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
}));

import { GitDiffPanel } from "./GitDiffPanel";

const baseProps = {
  mode: "diff" as const,
  onModeChange: vi.fn(),
  filePanelMode: "git" as const,
  onFilePanelModeChange: vi.fn(),
  branchName: "main",
  totalAdditions: 0,
  totalDeletions: 0,
  fileStatus: "No changes",
  stagedFiles: [],
  unstagedFiles: [],
  logEntries: [],
};

function createRect(left: number, right: number): DOMRect {
  return {
    x: left,
    y: 0,
    left,
    right,
    top: 0,
    bottom: 44,
    width: right - left,
    height: 44,
    toJSON: () => ({}),
  } as DOMRect;
}

afterEach(() => {
  cleanup();
  styleBoundaryState.ready = false;
  mockUseFeatureStylesReady.mockClear();
});

describe("GitDiffPanel style boundary", () => {
  it("does not mount Git business DOM while diff styles are loading", () => {
    const { container } = render(<GitDiffPanel {...baseProps} />);

    expect(mockUseFeatureStylesReady).toHaveBeenCalledOnce();
    expect(container.querySelector(".diff-panel")).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it("mounts Git business DOM after diff styles are ready", () => {
    styleBoundaryState.ready = true;
    const { container } = render(<GitDiffPanel {...baseProps} />);

    expect(container.querySelector(".diff-panel")).toBeTruthy();
  });
});

describe("GitDiffPanel external mode selector", () => {
  it("portals the only selector while preserving layout, focus, and worktree actions", () => {
    styleBoundaryState.ready = true;
    const onGitDiffListViewChange = vi.fn();
    const onApplyWorktreeChanges = vi.fn();
    render(<div data-testid="git-mode-controls-target" />);
    const headerControlsTarget = screen.getByTestId("git-mode-controls-target");
    const view = render(
      <GitDiffPanel
        {...baseProps}
        headerControlsTarget={headerControlsTarget}
        gitDiffListView="flat"
        onGitDiffListViewChange={onGitDiffListViewChange}
        onApplyWorktreeChanges={onApplyWorktreeChanges}
        unstagedFiles={[{ path: "file.txt", status: "M", additions: 1, deletions: 0 }]}
      />,
    );

    const trigger = within(headerControlsTarget).getByRole("button", {
      name: "git.panelView",
    });
    expect(view.container.querySelector(".git-panel-select")).toBeNull();
    expect(document.querySelectorAll(".git-panel-select")).toHaveLength(1);

    fireEvent.click(
      within(view.container).getByRole("button", {
        name: "git.applyWorktreeChangesAction",
      }),
    );
    expect(onApplyWorktreeChanges).toHaveBeenCalledTimes(1);

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menuitemradio", { name: "git.listTree" }));
    expect(onGitDiffListViewChange).toHaveBeenCalledWith("tree");

    fireEvent.click(trigger);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menu", { name: "git.panelView" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it.each([
    ["normal", [600, 900], [608, 680], "0px", "auto", "246px"],
    ["swapped", [100, 400], [320, 392], "auto", "0px", "246px"],
    ["narrow", [600, 750], [608, 680], "0px", "auto", "142px"],
  ] as const)(
    "positions the first %s menu within current panel bounds",
    (_layout, panelBounds, triggerBounds, expectedLeft, expectedRight, expectedWidth) => {
      styleBoundaryState.ready = true;
      render(<div data-testid="git-mode-controls-target" />);
      const headerControlsTarget = screen.getByTestId("git-mode-controls-target");
      const view = render(
        <GitDiffPanel
          {...baseProps}
          headerControlsTarget={headerControlsTarget}
        />,
      );
      const panel = view.container.querySelector<HTMLElement>(".diff-panel");
      const trigger = within(headerControlsTarget).getByRole("button", {
        name: "git.panelView",
      });
      if (!panel) {
        throw new Error("Git diff panel not found");
      }
      vi.spyOn(panel, "getBoundingClientRect").mockReturnValue(
        createRect(panelBounds[0], panelBounds[1]),
      );
      vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(
        createRect(triggerBounds[0], triggerBounds[1]),
      );

      fireEvent.click(trigger);

      const menu = screen.getByRole("menu", { name: "git.panelView" });
      expect(menu.style.left).toBe(expectedLeft);
      expect(menu.style.right).toBe(expectedRight);
      expect(menu.style.width).toBe(expectedWidth);
    },
  );
});
