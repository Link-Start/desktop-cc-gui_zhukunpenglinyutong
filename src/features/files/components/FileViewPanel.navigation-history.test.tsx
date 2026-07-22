/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildLocation,
  mockCodeMirrorDispatch,
  mockCodeMirrorScrollDOM,
} from "./FileViewPanel.test-utils";
import { FileViewPanel } from "./FileViewPanel";
import { clearFileDocumentSessionCacheForTests } from "../hooks/useFileDocumentState";
import {
  getCodeIntelDefinition,
  getCodeIntelImplementations,
  readWorkspaceFile,
} from "../../../services/tauri";

function openFileContentContextMenu() {
  const editor = screen.getByTestId("mock-codemirror");
  fireEvent.contextMenu(editor, { clientX: 120, clientY: 80 });
  return screen.getByRole("menu", { name: "files.fileContextMenu" });
}

function clickNavigationMenuItem(name: string) {
  fireEvent.click(within(openFileContentContextMenu()).getByRole("menuitem", { name }));
}

function expectNavigationDisabled(direction: "Back" | "Forward", disabled: boolean) {
  expect(
    (screen.getByRole("button", {
      name: `files.navigation${direction}`,
    }) as HTMLButtonElement).disabled,
  ).toBe(disabled);
}

describe("FileViewPanel semantic navigation history", () => {
  afterEach(() => {
    cleanup();
    clearFileDocumentSessionCacheForTests();
    mockCodeMirrorScrollDOM.scrollTop = 0;
    vi.clearAllMocks();
  });

  it("restores the latest cursor and vertical viewport snapshot", async () => {
    const contentByPath: Record<string, string> = {
      "src/A.java": "one\nalpha\nthree",
      "src/B.java": "zero\nbeta\nlast",
    };
    vi.mocked(readWorkspaceFile).mockImplementation(async (_workspaceId, path) => ({
      content: contentByPath[path] ?? "",
      truncated: false,
    }));
    vi.mocked(getCodeIntelDefinition).mockResolvedValue({
      result: [buildLocation("src/B.java", 1, 1)],
    } as any);

    function NavigationHarness() {
      const [filePath, setFilePath] = useState("src/A.java");
      const [navigationTarget, setNavigationTarget] = useState<{
        path: string;
        line: number;
        column: number;
        requestId: number;
      } | null>(null);
      const requestIdRef = useRef(0);
      return (
        <FileViewPanel
          workspaceId="ws-navigation-viewport"
          workspacePath="/repo"
          filePath={filePath}
          navigationTarget={navigationTarget}
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onNavigateToLocation={(path, location) => {
            requestIdRef.current += 1;
            setFilePath(path);
            setNavigationTarget({ ...location, path, requestId: requestIdRef.current });
          }}
          onClose={vi.fn()}
        />
      );
    }

    render(<NavigationHarness />);
    const sourceEditor = await screen.findByTestId("mock-codemirror") as HTMLTextAreaElement;
    sourceEditor.setSelectionRange(6, 6);
    fireEvent.select(sourceEditor);
    mockCodeMirrorScrollDOM.scrollTop = 144;

    clickNavigationMenuItem("files.gotoDefinition");
    await waitForEditorValue(contentByPath["src/B.java"]!);
    await waitFor(() => expectNavigationDisabled("Back", false));

    const targetEditor = screen.getByTestId("mock-codemirror") as HTMLTextAreaElement;
    targetEditor.setSelectionRange(14, 14);
    fireEvent.select(targetEditor);
    mockCodeMirrorScrollDOM.scrollTop = 320;
    mockCodeMirrorDispatch.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "files.navigationBack" }));
    await waitForEditorValue(contentByPath["src/A.java"]!);
    await waitFor(() => {
      expect(mockCodeMirrorDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ selection: { anchor: 6, head: 6 } }),
      );
      expect(mockCodeMirrorScrollDOM.scrollTop).toBe(144);
    });

    mockCodeMirrorDispatch.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "files.navigationForward" }));
    await waitForEditorValue(contentByPath["src/B.java"]!);
    await waitFor(() => {
      expect(mockCodeMirrorDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ selection: { anchor: 14, head: 14 } }),
      );
      expect(mockCodeMirrorScrollDOM.scrollTop).toBe(320);
    });
  });

  it("starts with both history controls disabled", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "class Main {}",
      truncated: false,
    });

    render(
      <FileViewPanel
        workspaceId="ws-navigation-empty-history"
        workspacePath="/repo"
        filePath="src/Main.java"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await screen.findByTestId("mock-codemirror");
    expectNavigationDisabled("Back", true);
    expectNavigationDisabled("Forward", true);
  });

  it("traverses a chain and truncates the forward branch after a new jump", async () => {
    vi.mocked(readWorkspaceFile).mockImplementation(async (_workspaceId, path) => ({
      content: path,
      truncated: false,
    }));
    vi.mocked(getCodeIntelDefinition).mockImplementation(async (_workspaceId, request) => ({
      result: request.filePath === "src/A.java"
        ? [buildLocation("src/B.java", 9, 2)]
        : [buildLocation("src/C.java", 19, 4)],
    }) as any);
    const onNavigateToLocation = vi.fn();
    const panel = (filePath: string) => (
      <FileViewPanel
        workspaceId="ws-navigation-history"
        workspacePath="/repo"
        filePath={filePath}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onNavigateToLocation={onNavigateToLocation}
        onClose={vi.fn()}
      />
    );
    const { rerender } = render(panel("src/A.java"));

    await screen.findByTestId("mock-codemirror");
    expectNavigationDisabled("Back", true);
    clickNavigationMenuItem("files.gotoDefinition");
    await waitFor(() => {
      expect(onNavigateToLocation).toHaveBeenLastCalledWith("src/B.java", {
        line: 10,
        column: 3,
      });
    });

    rerender(panel("src/B.java"));
    await waitForEditorValue("src/B.java");
    clickNavigationMenuItem("files.gotoDefinition");
    await waitFor(() => {
      expect(onNavigateToLocation).toHaveBeenLastCalledWith("src/C.java", {
        line: 20,
        column: 5,
      });
    });

    rerender(panel("src/C.java"));
    await waitForEditorValue("src/C.java");
    onNavigateToLocation.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "files.navigationBack" }));
    expect(onNavigateToLocation).toHaveBeenLastCalledWith("src/B.java", {
      line: 1,
      column: 1,
    });

    rerender(panel("src/B.java"));
    await waitForEditorValue("src/B.java");
    fireEvent.click(screen.getByRole("button", { name: "files.navigationBack" }));
    expect(onNavigateToLocation).toHaveBeenLastCalledWith("src/A.java", {
      line: 1,
      column: 1,
    });

    rerender(panel("src/A.java"));
    await waitForEditorValue("src/A.java");
    fireEvent.click(screen.getByRole("button", { name: "files.navigationForward" }));
    expect(onNavigateToLocation).toHaveBeenLastCalledWith("src/B.java", {
      line: 1,
      column: 1,
    });

    rerender(panel("src/B.java"));
    await waitForEditorValue("src/B.java");
    vi.mocked(getCodeIntelImplementations).mockResolvedValue({
      result: [buildLocation("src/D.java", 29, 6)],
    } as any);
    clickNavigationMenuItem("files.gotoImplementations");
    await waitFor(() => {
      expect(onNavigateToLocation).toHaveBeenLastCalledWith("src/D.java", {
        line: 30,
        column: 7,
      });
    });
    rerender(panel("src/D.java"));
    await waitForEditorValue("src/D.java");
    expectNavigationDisabled("Forward", true);
  });

  it("does not record same-file semantic positioning", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "class Symbol {}",
      truncated: false,
    });
    vi.mocked(getCodeIntelDefinition).mockResolvedValue({
      result: [buildLocation("src/A.java", 7, 3)],
    } as any);
    const onNavigateToLocation = vi.fn();

    render(
      <FileViewPanel
        workspaceId="ws-navigation-same-file"
        workspacePath="/repo"
        filePath="src/A.java"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onNavigateToLocation={onNavigateToLocation}
        onClose={vi.fn()}
      />,
    );

    await screen.findByTestId("mock-codemirror");
    clickNavigationMenuItem("files.gotoDefinition");
    await waitFor(() => {
      expect(onNavigateToLocation).toHaveBeenCalledWith("src/A.java", {
        line: 8,
        column: 4,
      });
    });
    expectNavigationDisabled("Back", true);
  });

  it("clears the chain when a file is activated outside owned navigation", async () => {
    vi.mocked(readWorkspaceFile).mockImplementation(async (_workspaceId, path) => ({
      content: path,
      truncated: false,
    }));
    vi.mocked(getCodeIntelDefinition).mockResolvedValue({
      result: [buildLocation("src/B.java", 4, 1)],
    } as any);
    const onNavigateToLocation = vi.fn();
    const panel = (filePath: string) => (
      <FileViewPanel
        workspaceId="ws-navigation-isolation"
        workspacePath="/repo"
        filePath={filePath}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onNavigateToLocation={onNavigateToLocation}
        onClose={vi.fn()}
      />
    );
    const { rerender } = render(panel("src/A.java"));

    await screen.findByTestId("mock-codemirror");
    clickNavigationMenuItem("files.gotoDefinition");
    await waitFor(() => expectNavigationDisabled("Back", false));
    rerender(panel("src/B.java"));
    await waitForEditorValue("src/B.java");
    rerender(panel("src/Manual.java"));
    await waitForEditorValue("src/Manual.java");

    expectNavigationDisabled("Back", true);
    expectNavigationDisabled("Forward", true);
  });

  it("maps history shortcuts for macOS and Windows", async () => {
    const originalPlatform = window.navigator.platform;
    Object.defineProperty(window.navigator, "platform", {
      configurable: true,
      value: "MacIntel",
    });
    try {
      vi.mocked(readWorkspaceFile).mockImplementation(async (_workspaceId, path) => ({
        content: path,
        truncated: false,
      }));
      vi.mocked(getCodeIntelDefinition).mockResolvedValue({
        result: [buildLocation("src/B.java", 4, 1)],
      } as any);
      const onNavigateToLocation = vi.fn();
      const panel = (filePath: string) => (
        <FileViewPanel
          workspaceId="ws-navigation-shortcuts"
          workspacePath="/repo"
          filePath={filePath}
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onNavigateToLocation={onNavigateToLocation}
          onClose={vi.fn()}
        />
      );
      const { rerender } = render(panel("src/A.java"));

      await screen.findByTestId("mock-codemirror");
      clickNavigationMenuItem("files.gotoDefinition");
      await waitFor(() => {
        expect(onNavigateToLocation).toHaveBeenCalledWith("src/B.java", {
          line: 5,
          column: 2,
        });
      });
      rerender(panel("src/B.java"));
      await waitForEditorValue("src/B.java");
      onNavigateToLocation.mockClear();

      fireEvent.keyDown(window, { key: "ArrowLeft", metaKey: true, altKey: true });
      expect(onNavigateToLocation).toHaveBeenLastCalledWith("src/A.java", {
        line: 1,
        column: 1,
      });

      rerender(panel("src/A.java"));
      await waitForEditorValue("src/A.java");
      Object.defineProperty(window.navigator, "platform", {
        configurable: true,
        value: "Win32",
      });
      fireEvent.keyDown(window, { key: "ArrowRight", ctrlKey: true, altKey: true });
      expect(onNavigateToLocation).toHaveBeenLastCalledWith("src/B.java", {
        line: 1,
        column: 1,
      });
    } finally {
      Object.defineProperty(window.navigator, "platform", {
        configurable: true,
        value: originalPlatform,
      });
    }
  });

  it("preserves a supplied detached explorer leading action", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "class Main {}",
      truncated: false,
    });
    const onSingleRowLeadingAction = vi.fn();

    render(
      <FileViewPanel
        workspaceId="ws-detached-leading-action"
        workspacePath="/repo"
        filePath="src/Main.java"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
        onSingleRowLeadingAction={onSingleRowLeadingAction}
        singleRowLeadingLabel="collapse-sidebar"
      />,
    );

    await screen.findByTestId("mock-codemirror");
    expect(screen.queryByRole("button", { name: "files.navigationBack" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "collapse-sidebar" }));
    expect(onSingleRowLeadingAction).toHaveBeenCalledTimes(1);
  });
});

async function waitForEditorValue(expectedValue: string) {
  await waitFor(() => {
    expect((screen.getByTestId("mock-codemirror") as HTMLTextAreaElement).value).toBe(
      expectedValue,
    );
  });
}
