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

  it.each([
      [
        "definition",
        "files.gotoDefinition",
        () =>
          vi.mocked(getCodeIntelDefinition).mockResolvedValue({
            filePath: "src/Main.java",
            line: 0,
            character: 0,
            language: "java",
            mode: "fast-search",
            provider: "heuristic",
            lifecycle: "degraded",
            fallbackReasonCode: "provider-unavailable",
            result: [buildLocation("src/Foo.java", 9, 2)],
          }),
      ],
      [
        "implementation",
        "files.gotoImplementations",
        () =>
          vi.mocked(getCodeIntelImplementations).mockResolvedValue({
            filePath: "src/Main.java",
            line: 0,
            character: 0,
            language: "java",
            mode: "fast-search",
            provider: "heuristic",
            lifecycle: "degraded",
            fallbackReasonCode: "provider-unavailable",
            result: [buildLocation("src/Foo.java", 9, 2)],
          }),
      ],
    ] as const)(
      "keeps single-target %s fallback visible until the user chooses the result",
      async (_action, menuItem, arrangeResponse) => {
        vi.mocked(readWorkspaceFile).mockResolvedValue({
          content: "class Main {}",
          truncated: false,
        });
        arrangeResponse();
        const onNavigateToLocation = vi.fn();

        render(
          <FileViewPanel
            workspaceId="ws-single-provider-fallback"
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
        clickFileContextMenuItem(menuItem);

        await screen.findByText(/files\.navigationLanguageServerMissing · Java/);
        expect(onNavigateToLocation).not.toHaveBeenCalled();
        fireEvent.click(screen.getByText("src/Foo.java"));
        expect(onNavigateToLocation).toHaveBeenCalledWith("src/Foo.java", {
          line: 10,
          column: 3,
        });
      },
    );

  it("keeps an unavailable-provider command selectable without clipboard access", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "const value = 1;",
        truncated: false,
      });
      vi.mocked(getCodeIntelReferences).mockResolvedValue({
        filePath: "src/value.ts",
        line: 0,
        character: 0,
        language: "TS/JS",
        mode: "fast-search",
        provider: "heuristic",
        lifecycle: "degraded",
        fallbackReasonCode: "provider-unavailable",
        result: [],
      });
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: undefined,
      });

      render(
        <FileViewPanel
          workspaceId="ws-navigation-no-clipboard"
          workspacePath="/repo"
          filePath="src/value.ts"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await screen.findByTestId("mock-codemirror");
      clickFileContextMenuItem("files.findReferences");
      expect(
        await screen.findByText(
          "npm install -g typescript-language-server typescript",
        ),
      ).toBeTruthy();
      expect(
        screen.queryByRole("button", {
          name: "files.navigationCopyInstallCommand",
        }),
      ).toBeNull();
      expect(
        screen.getByRole("button", {
          name: "files.navigationRetryAfterInstall",
        }),
      ).toBeTruthy();
    });

  it("does not suggest installation for provider timeouts", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "class Main {}",
        truncated: false,
      });
      vi.mocked(getCodeIntelReferences).mockResolvedValue({
        filePath: "src/Main.java",
        line: 0,
        character: 0,
        language: "Java",
        mode: "semantic",
        provider: "eclipse-jdt-ls",
        lifecycle: "indexing",
        fallbackReasonCode: "request-timeout",
        result: [],
      });

      render(
        <FileViewPanel
          workspaceId="ws-navigation-timeout-fallback"
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
      await waitFor(() => {
        expect(
          document.querySelector(".fvp-navigation-status-detail")?.textContent,
        ).toContain("files.navigationIndexing");
      });
      expect(screen.queryByText(/download\.eclipse\.org\/jdtls/)).toBeNull();
      expect(
        screen.queryByRole("button", {
          name: "files.navigationCopyInstallCommand",
        }),
      ).toBeNull();
      expect(
        screen.getByRole("button", {
          name: /retry/i,
        }),
      ).toBeTruthy();
    });

  it("shows the target language while a semantic provider is preparing", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "class Main {}",
        truncated: false,
      });
      let resolveDefinition!: (
        value: Awaited<ReturnType<typeof getCodeIntelDefinition>>,
      ) => void;
      vi.mocked(getCodeIntelDefinition).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveDefinition = resolve;
          }),
      );

      render(
        <FileViewPanel
          workspaceId="ws-navigation-loading"
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
      await waitFor(() => {
        const mode = document.querySelector(".fvp-navigation-mode");
        expect(mode?.textContent).toContain("files.navigationPreparing");
        expect(mode?.textContent).toContain("Java");
      });

      resolveDefinition({
        filePath: "src/Main.java",
        line: 0,
        character: 0,
        language: "java",
        mode: "semantic",
        provider: "eclipse-jdt-ls",
        lifecycle: "ready",
        fallbackReasonCode: null,
        result: [],
      });
      await screen.findByText("files.navigationNoDefinition");
    });

  it("retries a failed navigation request immediately", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "class Main {}",
        truncated: false,
      });
      vi.mocked(getCodeIntelDefinition)
        .mockRejectedValueOnce(new Error("No symbol under cursor"))
        .mockResolvedValueOnce({
          filePath: "src/Main.java",
          line: 0,
          character: 0,
          language: "java",
          mode: "semantic",
          provider: "eclipse-jdt-ls",
          lifecycle: "ready",
          fallbackReasonCode: null,
          result: [buildLocation("src/Foo.java", 9, 2)],
        });
      const onNavigateToLocation = vi.fn();

      render(
        <FileViewPanel
          workspaceId="ws-navigation-retry"
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
      clickFileContextMenuItem("files.gotoDefinition");
      await screen.findByText("files.navigationDefinitionSymbolRequired");
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));

      await waitFor(() => {
        expect(getCodeIntelDefinition).toHaveBeenCalledTimes(2);
        expect(onNavigateToLocation).toHaveBeenCalledWith("src/Foo.java", {
          line: 10,
          column: 3,
        });
      });
      consoleErrorSpy.mockRestore();
    });

  it("renders maximize toggle and triggers callback", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "class Main {}",
        truncated: false,
      });
      const onToggleEditorFileMaximized = vi.fn();

      render(
        <FileViewPanel
          workspaceId="ws-4"
          workspacePath="/repo"
          filePath="src/Main.java"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onToggleEditorFileMaximized={onToggleEditorFileMaximized}
          onClose={vi.fn()}
        />,
      );

      await screen.findByTestId("mock-codemirror");
      const maximizeButton = screen.getByRole("button", {
        name: /Maximize|menu\.maximize/i,
      });
      fireEvent.click(maximizeButton);
      expect(onToggleEditorFileMaximized).toHaveBeenCalledTimes(1);
    });

  it("double-clicking a file tab toggles maximize callback", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "class Main {}",
        truncated: false,
      });
      const onToggleEditorFileMaximized = vi.fn();

      render(
        <FileViewPanel
          workspaceId="ws-tab-max"
          workspacePath="/repo"
          filePath="src/Main.java"
          openTabs={["src/Main.java"]}
          activeTabPath="src/Main.java"
          onToggleEditorFileMaximized={onToggleEditorFileMaximized}
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await screen.findByTestId("mock-codemirror");
      const fileTab = screen.getByRole("tab", { name: "Main.java" });
      const expectedIcon = document.createElement("span");
      expectedIcon.innerHTML = getFileTreeIconSvg("Main.java", false);
      expect(fileTab.querySelector(".fvp-tab-icon")?.innerHTML).toBe(
        expectedIcon.innerHTML,
      );
      fireEvent.doubleClick(fileTab);
      expect(onToggleEditorFileMaximized).toHaveBeenCalledTimes(1);
    });

  it("renders tabs and the leading action in one header row", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "class Main {}",
        truncated: false,
      });

      const { container } = render(
        <FileViewPanel
          workspaceId="ws-single-row-header"
          workspacePath="/repo"
          filePath="src/Main.java"
          openTabs={["src/Main.java", "src/Foo.java"]}
          activeTabPath="src/Main.java"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
          headerLayout="single-row"
        />,
      );

      await screen.findByTestId("mock-codemirror");
      expect(container.querySelector(".fvp-header-row")).toBeTruthy();
      expect(
        container
          .querySelector(".fvp-header-row")
          ?.hasAttribute("data-tauri-drag-region"),
      ).toBe(false);
      expect(
        container
          .querySelector(".fvp-header-row-tabs")
          ?.hasAttribute("data-tauri-drag-region"),
      ).toBe(false);
      expect(
        container
          .querySelector(".fvp-tabs-inline")
          ?.hasAttribute("data-tauri-drag-region"),
      ).toBe(false);
      expect(
        container
          .querySelector(".fvp-tabs-inline .fvp-tabs-track")
          ?.hasAttribute("data-tauri-drag-region"),
      ).toBe(false);
      expect(container.querySelector(".fvp-topbar")).toBeNull();
      expect(screen.getByRole("tablist", { name: "Open files" })).toBeTruthy();
      expect(screen.queryByTitle("files.backToChat")).toBeNull();
      expect(
        within(openFileContentContextMenu()).getByRole("menuitem", {
          name: "files.gotoDefinition",
        }),
      ).toBeTruthy();
    });

  it("copies and pastes the CodeMirror selection from the file context menu", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "class Main {}",
        truncated: false,
      });
      const writeText = vi.fn(async () => undefined);
      const readText = vi.fn(async () => "pasted text");
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText, readText },
      });

      render(
        <FileViewPanel
          workspaceId="ws-file-menu-clipboard"
          workspacePath="/repo"
          filePath="src/Main.java"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      const editor = (await screen.findByTestId(
        "mock-codemirror",
      )) as HTMLTextAreaElement;
      editor.setSelectionRange(0, 5);
      fireEvent.select(editor);
      fireEvent.click(
        within(openFileContentContextMenu()).getByRole("menuitem", {
          name: "files.copyItem",
        }),
      );
      await waitFor(() => expect(writeText).toHaveBeenCalledWith("class"));

      mockCodeMirrorDispatch.mockClear();
      fireEvent.click(
        within(openFileContentContextMenu()).getByRole("menuitem", {
          name: "files.pasteItem",
        }),
      );
      await waitFor(() => {
        expect(readText).toHaveBeenCalledTimes(1);
        expect(mockCodeMirrorDispatch).toHaveBeenCalledWith({
          changes: { from: 0, to: 5, insert: "pasted text" },
        });
      });
    });

  it("exposes expand selection with a platform shortcut hint in the editor menu", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "class Main {}",
        truncated: false,
      });

      render(
        <FileViewPanel
          workspaceId="ws-expand-selection-menu"
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
      const menu = within(openFileContentContextMenu());
      const item = menu.getByRole("menuitem", { name: "files.expandSelection" });

      expect(
        item.querySelector(".renderer-context-menu-item-shortcut")?.textContent,
      ).toMatch(/^(⌘W|Ctrl\+W)$/);
      expect(item.closest(".fvp-file-context-menu")).not.toBeNull();
    });
});
