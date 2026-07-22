// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuickSwitcher } from "./QuickSwitcher";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../../../utils/time", () => ({
  formatRelativeTimeShort: () => "now",
}));

vi.mock("../hooks/useQuickSwitcherRecentFiles", () => ({
  useQuickSwitcherRecentFiles: () => [
    {
      workspaceId: "workspace-a",
      workspaceName: "MossX",
      latestAt: 10,
      files: [
        {
          workspaceId: "workspace-a",
          path: "src/components/App.tsx",
          touchedAt: 10,
          source: "ai-modified",
          aiModifiedAt: 10,
        },
      ],
    },
  ],
}));

const sessionGroups = [
  {
    workspaceId: "workspace-a",
    workspaceName: "MossX",
    latestAt: 20,
    sessions: [
      {
        workspaceId: "workspace-a",
        id: "current-thread",
        title: "Current session",
        updatedAt: 20,
        engine: "codex" as const,
        isShared: false,
      },
      {
        workspaceId: "workspace-a",
        id: "next-thread",
        title: "Next session",
        updatedAt: 19,
        engine: "claude" as const,
        isShared: false,
      },
    ],
  },
];

const baseProps = {
  workspaces: [{ id: "workspace-a", name: "MossX" }],
  activeWorkspaceId: "workspace-a",
  activeThreadId: "current-thread",
  activeFilePath: null,
  sessionGroups,
  onNavigate: vi.fn(),
  onSelectSession: vi.fn(),
  onSelectFile: vi.fn(),
  onClose: vi.fn(),
};

describe("QuickSwitcher", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders parallel workspace-grouped panes without a search input", () => {
    const { container } = render(<QuickSwitcher {...baseProps} />);

    expect(container.querySelectorAll(".quick-switcher-recent-pane")).toHaveLength(2);
    expect(screen.getByText("quickSwitcher.recentSessions")).toBeTruthy();
    expect(screen.getByText("quickSwitcher.recentFiles")).toBeTruthy();
    expect(screen.getAllByText("MossX")).toHaveLength(2);
    expect(screen.getByText("App.tsx")).toBeTruthy();
    expect(
      screen.getByText("App.tsx").closest(".quick-switcher-file-label"),
    ).toBeTruthy();
    expect(screen.getByText("quickSwitcher.nav.intentCanvas")).toBeTruthy();
    expect(screen.getByText("quickSwitcher.nav.projectMap")).toBeTruthy();
    expect(document.querySelector("input")).toBeNull();
    expect(screen.getByText("Ctrl+E")).toBeTruthy();
  });

  it("defaults to the session after the current one and activates with Enter", () => {
    const onSelectSession = vi.fn();
    render(<QuickSwitcher {...baseProps} onSelectSession={onSelectSession} />);

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Enter" });
    expect(onSelectSession).toHaveBeenCalledWith("workspace-a", "next-thread");
  });

  it("moves across all three panes with horizontal arrows", () => {
    const onSelectFile = vi.fn();
    render(<QuickSwitcher {...baseProps} onSelectFile={onSelectFile} />);

    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    fireEvent.keyDown(dialog, { key: "Enter" });
    expect(onSelectFile).toHaveBeenCalledWith(
      "workspace-a",
      "src/components/App.tsx",
    );
  });

  it("switches to navigation and closes with Escape", () => {
    const onNavigate = vi.fn();
    const onClose = vi.fn();
    render(
      <QuickSwitcher
        {...baseProps}
        onNavigate={onNavigate}
        onClose={onClose}
      />,
    );

    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    fireEvent.keyDown(dialog, { key: "ArrowDown" });
    fireEvent.keyDown(dialog, { key: "Enter" });
    expect(onNavigate).toHaveBeenCalledWith("files");

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
