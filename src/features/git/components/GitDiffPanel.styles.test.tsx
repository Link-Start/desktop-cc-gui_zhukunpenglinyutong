/** @vitest-environment jsdom */
import { cleanup, render } from "@testing-library/react";
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
