/** @vitest-environment jsdom */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
  afterEach,
  describe,
  expect,
  it,
  vi,
  buildLocation,
  buildWindowsLocation,
  mermaidInitialize,
  mermaidRender,
  mockCodeMirrorDispatch,
  mockOpenNewDetachedFileExplorerWindow,
  mockPushErrorToast,
  FileViewPanel,
  resolveEditorAnnotationWidgetOrder,
  clearFileDocumentSessionCacheForTests,
  getCodeIntelDefinition,
  getCodeIntelImplementations,
  getCodeIntelReferences,
  getGitFileFullDiff,
  prepareCodeIntel,
  readLocalImageDataUrl,
  readExternalAbsoluteFile,
  readExternalSpecFile,
  readWorkspaceFile,
  writeExternalSpecFile,
  writeWorkspaceFile,
  loadKatexAssets,
  useFilePreviewPayload,
  getFileTreeIconSvg,
  openFileContentContextMenu,
  clickFileContextMenuItem,
  toggleFileGitBlame,
} from "./FileViewPanelTestHarness";

void [act, cleanup, fireEvent, render, screen, waitFor, within, afterEach, describe, expect, it, vi, buildLocation, buildWindowsLocation, mermaidInitialize, mermaidRender, mockCodeMirrorDispatch, mockOpenNewDetachedFileExplorerWindow, mockPushErrorToast, FileViewPanel, resolveEditorAnnotationWidgetOrder, clearFileDocumentSessionCacheForTests, getCodeIntelDefinition, getCodeIntelImplementations, getCodeIntelReferences, getGitFileFullDiff, prepareCodeIntel, readLocalImageDataUrl, readExternalAbsoluteFile, readExternalSpecFile, readWorkspaceFile, writeExternalSpecFile, writeWorkspaceFile, loadKatexAssets, useFilePreviewPayload, getFileTreeIconSvg, openFileContentContextMenu, clickFileContextMenuItem, toggleFileGitBlame];

describe("FileViewPanel navigation", () => {
  afterEach(() => {
      cleanup();
      clearFileDocumentSessionCacheForTests();
      vi.clearAllMocks();
      mockCodeMirrorDispatch.mockReset();
      mockOpenNewDetachedFileExplorerWindow.mockClear();
    });

  it("prewarms the shared TypeScript server for JavaScript after 750ms idle", async () => {
      vi.useFakeTimers();
      try {
        vi.mocked(readWorkspaceFile).mockResolvedValue({
          content: "export const value = 1;",
          truncated: false,
        });

        render(
          <FileViewPanel
            workspaceId="ws-js-prewarm"
            workspacePath="/repo"
            filePath="src/value.js"
            openTargets={[]}
            openAppIconById={{}}
            selectedOpenAppId=""
            onSelectOpenAppId={vi.fn()}
            onClose={vi.fn()}
          />,
        );

        expect(prepareCodeIntel).not.toHaveBeenCalled();
        await act(async () => {
          vi.advanceTimersByTime(749);
          await Promise.resolve();
        });
        expect(prepareCodeIntel).not.toHaveBeenCalled();
        await act(async () => {
          vi.advanceTimersByTime(1);
          await Promise.resolve();
        });
        expect(prepareCodeIntel).toHaveBeenCalledWith(
          "ws-js-prewarm",
          "src/value.js",
        );
      } finally {
        vi.useRealTimers();
      }
    });

  it.each([
      ["Python", "src/main.py"],
      ["Python stub", "src/types.pyi"],
      ["Go", "cmd/main.go"],
    ])("prewarms the %s semantic provider after 750ms idle", async (_language, filePath) => {
      vi.useFakeTimers();
      try {
        vi.mocked(readWorkspaceFile).mockResolvedValue({
          content: "symbol",
          truncated: false,
        });

        render(
          <FileViewPanel
            workspaceId="ws-python-go-prewarm"
            workspacePath="/repo"
            filePath={filePath}
            openTargets={[]}
            openAppIconById={{}}
            selectedOpenAppId=""
            onSelectOpenAppId={vi.fn()}
            onClose={vi.fn()}
          />,
        );

        await act(async () => {
          vi.advanceTimersByTime(750);
          await Promise.resolve();
        });
        expect(prepareCodeIntel).toHaveBeenCalledWith(
          "ws-python-go-prewarm",
          filePath,
        );
      } finally {
        vi.useRealTimers();
      }
    });

  it("cancels semantic prewarm for unsupported or unmounted files", async () => {
      vi.useFakeTimers();
      try {
        vi.mocked(readWorkspaceFile).mockResolvedValue({
          content: "notes",
          truncated: false,
        });
        const unsupported = render(
          <FileViewPanel
            workspaceId="ws-prewarm-cleanup"
            workspacePath="/repo"
            filePath="notes/readme.txt"
            openTargets={[]}
            openAppIconById={{}}
            selectedOpenAppId=""
            onSelectOpenAppId={vi.fn()}
            onClose={vi.fn()}
          />,
        );
        act(() => vi.advanceTimersByTime(750));
        expect(prepareCodeIntel).not.toHaveBeenCalled();
        unsupported.unmount();

        const supported = render(
          <FileViewPanel
            workspaceId="ws-prewarm-cleanup"
            workspacePath="/repo"
            filePath="src/Main.java"
            openTargets={[]}
            openAppIconById={{}}
            selectedOpenAppId=""
            onSelectOpenAppId={vi.fn()}
            onClose={vi.fn()}
          />,
        );
        supported.unmount();
        act(() => vi.advanceTimersByTime(750));
        expect(prepareCodeIntel).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

  it("navigates directly when definition has a single target", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "class Main {}",
        truncated: false,
      });
      vi.mocked(getCodeIntelDefinition).mockResolvedValue({
        result: [buildLocation("src/Foo.java", 9, 2)],
      } as any);
      const onNavigateToLocation = vi.fn();

      render(
        <FileViewPanel
          workspaceId="ws-1"
          workspacePath="/repo"
          filePath="src/Main.java"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onNavigateToLocation={onNavigateToLocation}
          onClose={vi.fn()}
        />,
      );

      await screen.findByTestId("mock-codemirror");
      fireEvent.click(
        within(openFileContentContextMenu()).getByRole("menuitem", {
          name: "files.gotoDefinition",
        }),
      );

      await waitFor(() => {
        expect(getCodeIntelDefinition).toHaveBeenCalled();
        expect(onNavigateToLocation).toHaveBeenCalledWith("src/Foo.java", {
          line: 10,
          column: 3,
        });
      });
    });

  it("shows definition candidates when multiple targets are returned", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "class Main {}",
        truncated: false,
      });
      vi.mocked(getCodeIntelDefinition).mockResolvedValue({
        result: [
          buildLocation("src/Foo.java", 3, 1),
          buildLocation("src/Bar.java", 12, 6),
        ],
      } as any);
      const onNavigateToLocation = vi.fn();

      render(
        <FileViewPanel
          workspaceId="ws-2"
          workspacePath="/repo"
          filePath="src/Main.java"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onNavigateToLocation={onNavigateToLocation}
          onClose={vi.fn()}
        />,
      );

      await screen.findByTestId("mock-codemirror");
      fireEvent.click(
        within(openFileContentContextMenu()).getByRole("menuitem", {
          name: "files.gotoDefinition",
        }),
      );

      await waitFor(() => {
        expect(screen.getByText("src/Foo.java")).toBeTruthy();
        expect(screen.getByText("src/Bar.java")).toBeTruthy();
      });

      fireEvent.click(screen.getByText("src/Bar.java"));

      expect(onNavigateToLocation).toHaveBeenCalledWith("src/Bar.java", {
        line: 13,
        column: 7,
      });
    });

  it("navigates to an implementation and forwards current document text", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "interface Renderer {}",
        truncated: false,
      });
      vi.mocked(getCodeIntelImplementations).mockResolvedValue({
        result: [buildLocation("src/Html.ts", 7, 0)],
      } as any);
      const onNavigateToLocation = vi.fn();

      render(
        <FileViewPanel
          workspaceId="ws-rust"
          workspacePath="/repo"
          filePath="src/types.ts"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onNavigateToLocation={onNavigateToLocation}
          onClose={vi.fn()}
        />,
      );

      await screen.findByTestId("mock-codemirror");
      fireEvent.click(
        within(openFileContentContextMenu()).getByRole("menuitem", {
          name: "files.gotoImplementations",
        }),
      );

      await waitFor(
        () => {
          expect(getCodeIntelImplementations).toHaveBeenCalledWith("ws-rust", {
            filePath: "src/types.ts",
            line: 0,
            character: 0,
            documentText: "interface Renderer {}",
          });
          expect(onNavigateToLocation).toHaveBeenCalledWith("src/Html.ts", {
            line: 8,
            column: 1,
          });
        },
        { timeout: 500 },
      );
    });

  it("shows localized action guidance instead of raw no-symbol backend errors", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "class Main {}",
        truncated: false,
      });
      vi.mocked(getCodeIntelDefinition).mockRejectedValue(
        new Error("No symbol under cursor"),
      );
      vi.mocked(getCodeIntelImplementations).mockRejectedValue(
        new Error("No symbol under cursor"),
      );
      vi.mocked(getCodeIntelReferences).mockRejectedValue(
        new Error("No symbol under cursor"),
      );

      render(
        <FileViewPanel
          workspaceId="ws-guidance"
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
      clickFileContextMenuItem("files.gotoDefinition");
      await screen.findByText("files.navigationDefinitionSymbolRequired");

      clickFileContextMenuItem("files.gotoImplementations");
      await screen.findByText("files.navigationImplementationSymbolRequired");

      clickFileContextMenuItem("files.findReferences");
      await screen.findByText("files.navigationReferencesSymbolRequired");
      expect(screen.queryByText("No symbol under cursor")).toBeNull();
      consoleErrorSpy.mockRestore();
    });

  it("normalizes Windows absolute code-intel paths back to workspace-relative navigation targets", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "const main = 1;",
        truncated: false,
      });
      vi.mocked(getCodeIntelDefinition).mockResolvedValue({
        result: [buildWindowsLocation("src/Foo.ts", 2, 5)],
      } as any);
      const onNavigateToLocation = vi.fn();

      render(
        <FileViewPanel
          workspaceId="ws-nav-win"
          workspacePath="C:/Repo"
          filePath="src/Main.ts"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onNavigateToLocation={onNavigateToLocation}
          onClose={vi.fn()}
        />,
      );

      await screen.findByTestId("mock-codemirror");
      fireEvent.click(
        within(openFileContentContextMenu()).getByRole("menuitem", {
          name: "files.gotoDefinition",
        }),
      );

      await waitFor(() => {
        expect(onNavigateToLocation).toHaveBeenCalledWith("src/Foo.ts", {
          line: 3,
          column: 6,
        });
      });
    });

  it("renders reference list and allows click-through navigation", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "class Main {}",
        truncated: false,
      });
      vi.mocked(getCodeIntelReferences).mockResolvedValue({
        result: [
          buildLocation("src/Foo.java", 5, 4),
          buildLocation("src/Baz.java", 17, 8),
        ],
      } as any);
      const onNavigateToLocation = vi.fn();

      render(
        <FileViewPanel
          workspaceId="ws-3"
          workspacePath="/repo"
          filePath="src/Main.java"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onNavigateToLocation={onNavigateToLocation}
          onClose={vi.fn()}
        />,
      );

      await screen.findByTestId("mock-codemirror");
      fireEvent.click(
        within(openFileContentContextMenu()).getByRole("menuitem", {
          name: "files.findReferences",
        }),
      );

      await waitFor(() => {
        expect(getCodeIntelReferences).toHaveBeenCalled();
        expect(screen.getByText("src/Foo.java")).toBeTruthy();
        expect(screen.getByText("src/Baz.java")).toBeTruthy();
      });

      fireEvent.click(screen.getByText("src/Baz.java"));

      expect(onNavigateToLocation).toHaveBeenCalledWith("src/Baz.java", {
        line: 18,
        column: 9,
      });
    });

  it("shows semantic mode and fast-search fallback without blocking navigation", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "class Main {}",
        truncated: false,
      });
      vi.mocked(getCodeIntelReferences).mockResolvedValue({
        filePath: "src/Main.java",
        line: 0,
        character: 0,
        language: "java",
        mode: "fast-search",
        provider: "heuristic",
        lifecycle: "degraded",
        fallbackReasonCode: "provider-unavailable",
        result: [buildLocation("src/Foo.java", 5, 4)],
      });
      const writeText = vi.fn(async () => undefined);
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText },
      });

      render(
        <FileViewPanel
          workspaceId="ws-navigation-mode"
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
      clickFileContextMenuItem("files.findReferences");

      await screen.findByText(/files\.navigationLanguageServerMissing · Java/);
      expect(screen.queryByText("files.navigationFallbackNotice")).toBeNull();
      expect(
        screen.getAllByText(/files\.navigationModeFastSearchFallback/).length,
      ).toBeGreaterThan(0);
      expect(screen.getByText("src/Foo.java")).toBeTruthy();
      expect(
        screen.getByText(
          'xdg-open "https://download.eclipse.org/jdtls/milestones/"',
        ),
      ).toBeTruthy();
      fireEvent.click(
        screen.getByRole("button", {
          name: "files.navigationCopyInstallCommand",
        }),
      );
      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith(
          'xdg-open "https://download.eclipse.org/jdtls/milestones/"',
        );
        expect(
          screen.getByText("files.navigationInstallCommandCopied"),
        ).toBeTruthy();
      });
      fireEvent.click(
        screen.getByRole("button", {
          name: "files.navigationRetryAfterInstall",
        }),
      );
      await waitFor(() => {
        expect(getCodeIntelReferences).toHaveBeenCalledTimes(2);
      });
    });
});
