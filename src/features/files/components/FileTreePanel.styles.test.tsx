/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const styleBoundaryState = vi.hoisted(() => ({ ready: false }));
const mockUseFeatureStylesReady = vi.hoisted(() =>
  vi.fn(() => styleBoundaryState.ready),
);

vi.mock("../../../styles/useFeatureStylesReady", () => ({
  useFeatureStylesReady: mockUseFeatureStylesReady,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (value: string) => value,
  invoke: vi.fn(async () => null),
}));

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: vi.fn(async () => undefined),
}));

vi.mock("../../../services/tauri", () => ({
  getWorkspaceDirectoryChildren: vi.fn(async () => ({
    files: [],
    directories: [],
    gitignored_files: [],
    gitignored_directories: [],
  })),
  readWorkspaceFile: vi.fn(async () => ({ content: "", truncated: false })),
  createWorkspaceDirectory: vi.fn(async () => undefined),
  copyWorkspaceItem: vi.fn(async () => undefined),
  duplicateWorkspaceItem: vi.fn(async () => undefined),
  pasteWorkspaceItem: vi.fn(async () => undefined),
  renameWorkspaceItem: vi.fn(async () => undefined),
  pasteExternalWorkspaceItems: vi.fn(async () => undefined),
  trashWorkspaceItem: vi.fn(async () => undefined),
  writeWorkspaceFile: vi.fn(async () => undefined),
  revealInFileManager: vi.fn(async () => undefined),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  confirm: vi.fn(async () => true),
}));

vi.mock("../../../components/FileIcon", () => ({
  default: () => <span data-testid="file-icon" />,
}));

vi.mock("./FilePreviewPopover", () => ({
  FilePreviewPopover: () => <div data-testid="file-preview-popover" />,
}));

let FileTreePanel: typeof import("./FileTreePanel").FileTreePanel;

beforeAll(async () => {
  ({ FileTreePanel } = await import("./FileTreePanel"));
});

afterEach(() => {
  cleanup();
  styleBoundaryState.ready = false;
  mockUseFeatureStylesReady.mockClear();
});

const baseProps = {
  workspaceId: "workspace-1",
  workspaceName: "workspace",
  workspacePath: "/tmp/workspace",
  files: ["README.md"],
  isLoading: false,
  filePanelMode: "files" as const,
  onFilePanelModeChange: () => undefined,
  onOpenFile: () => undefined,
  openTargets: [],
  openAppIconById: {},
  selectedOpenAppId: "",
  onSelectOpenAppId: () => undefined,
};

describe("FileTreePanel style boundary", () => {
  it("does not mount file-tree business DOM while styles are loading", () => {
    const { container } = render(<FileTreePanel {...baseProps} />);

    expect(mockUseFeatureStylesReady).toHaveBeenCalledOnce();
    expect(container.querySelector(".file-tree-panel")).toBeNull();
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole("button", { name: "README.md" })).toBeNull();
  });

  it("mounts file-tree business DOM after styles are ready", () => {
    styleBoundaryState.ready = true;
    const { container } = render(<FileTreePanel {...baseProps} />);

    expect(container.querySelector(".file-tree-panel")).toBeTruthy();
    expect(screen.getByRole("button", { name: "README.md" })).toBeTruthy();
  });
});
