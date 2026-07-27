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

  it("shows executable IDEA-style shortcuts for file editor commands", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "class Main {}",
        truncated: false,
      });

      render(
        <FileViewPanel
          workspaceId="ws-file-menu-shortcuts"
          workspacePath="/repo"
          filePath="src/Main.java"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onAssociateIntentCanvasCodeAnchor={vi.fn()}
          onCaptureNote={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await screen.findByTestId("mock-codemirror");
      const menu = within(openFileContentContextMenu());
      const shortcutFor = (name: string) =>
        menu
          .getByRole("menuitem", { name })
          .querySelector(".renderer-context-menu-item-shortcut")?.textContent;

      expect(shortcutFor("files.cutItem")).toMatch(/^(⌘X|Ctrl\+X)$/);
      expect(shortcutFor("files.copyItem")).toMatch(/^(⌘C|Ctrl\+C)$/);
      expect(shortcutFor("files.pasteItem")).toMatch(/^(⌘V|Ctrl\+V)$/);
      expect(shortcutFor("noteCards.captureWholeFile")).toMatch(
        /^(⌥⇧N|Alt\+Shift\+N)$/,
      );
      expect(shortcutFor("files.associateIntentCanvas")).toMatch(
        /^(⌥⇧C|Alt\+Shift\+C)$/,
      );
      expect(shortcutFor("files.expandSelection")).toMatch(/^(⌘W|Ctrl\+W)$/);
      expect(shortcutFor("files.gotoDefinition")).toMatch(/^(⌘B|Ctrl\+B)$/);
      expect(shortcutFor("files.gotoImplementations")).toMatch(
        /^(⌘⌥B|Ctrl\+Alt\+B)$/,
      );
      expect(shortcutFor("files.findReferences")).toMatch(/^(⌥F7|Alt\+F7)$/);
      expect(shortcutFor("files.preview")).toMatch(/^(⌥⇧P|Alt\+Shift\+P)$/);
      expect(shortcutFor("files.saved")).toMatch(/^(⌘S|Ctrl\+S)$/);
    });

  it("keeps the expand-selection menu action when its shortcut is cleared", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "class Main {}",
        truncated: false,
      });

      render(
        <FileViewPanel
          workspaceId="ws-expand-selection-menu-no-shortcut"
          workspacePath="/repo"
          filePath="src/Main.java"
          expandSelectionShortcut={null}
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await screen.findByTestId("mock-codemirror");
      const item = within(openFileContentContextMenu()).getByRole("menuitem", {
        name: "files.expandSelection",
      });

      expect(
        item.querySelector(".renderer-context-menu-item-shortcut"),
      ).toBeNull();
    });

  it("preserves selected content when clipboard write fails during Cut", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "class Main {}",
        truncated: false,
      });
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: vi.fn(async () => {
            throw new Error("permission denied");
          }),
          readText: vi.fn(),
        },
      });

      render(
        <FileViewPanel
          workspaceId="ws-file-menu-cut-failure"
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
      mockCodeMirrorDispatch.mockClear();
      fireEvent.click(
        within(openFileContentContextMenu()).getByRole("menuitem", {
          name: "files.cutItem",
        }),
      );

      await waitFor(() => {
        expect(mockPushErrorToast).toHaveBeenCalledWith(
          expect.objectContaining({ title: "files.clipboardActionFailedTitle" }),
        );
      });
      expect(
        mockCodeMirrorDispatch.mock.calls.some(
          ([transaction]) => transaction?.changes,
        ),
      ).toBe(false);
      expect(editor.value).toBe("class Main {}");
    });

  it("disables mutating clipboard actions in preview mode", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "# Preview",
        truncated: false,
      });

      render(
        <FileViewPanel
          workspaceId="ws-file-menu-preview"
          workspacePath="/repo"
          filePath="README.md"
          initialMode="preview"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await screen.findByTestId("file-markdown-preview");
      fireEvent.contextMenu(screen.getByTestId("file-markdown-preview"));
      const menu = screen.getByRole("menu", { name: "files.fileContextMenu" });
      expect(
        (
          within(menu).getByRole("menuitem", {
            name: "files.cutItem",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
      expect(
        (
          within(menu).getByRole("menuitem", {
            name: "files.pasteItem",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
      expect(
        within(menu).getByRole("menuitem", { name: "files.edit" }),
      ).toBeTruthy();
      expect(
        within(menu).queryByRole("menuitem", { name: "files.expandSelection" }),
      ).toBeNull();
    });

  it("reveals the active file from the file content context menu", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "class Main {}",
        truncated: false,
      });
      const onRevealInFileTree = vi.fn();

      render(
        <FileViewPanel
          workspaceId="ws-reveal-file"
          workspacePath="/repo"
          filePath="src/features/Main.java"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onRevealInFileTree={onRevealInFileTree}
          onClose={vi.fn()}
        />,
      );

      await screen.findByTestId("mock-codemirror");
      const revealItem = within(openFileContentContextMenu()).getByRole(
        "menuitem",
        { name: "files.revealInFileTree" },
      );
      expect(
        revealItem.querySelector(".renderer-context-menu-item-shortcut")
          ?.textContent,
      ).toMatch(/^(⌥F1|Alt\+F1)$/);
      fireEvent.click(revealItem);

      expect(onRevealInFileTree).toHaveBeenCalledOnce();
      expect(onRevealInFileTree).toHaveBeenCalledWith("src/features/Main.java");
    });

  it("runs reveal and preview shortcuts only inside the file panel", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "class Main {}",
        truncated: false,
      });
      const onRevealInFileTree = vi.fn();
      const onAssociateIntentCanvasCodeAnchor = vi.fn();
      const onActiveCodeAnchorChange = vi.fn();

      render(
        <FileViewPanel
          workspaceId="ws-file-command-shortcuts"
          workspacePath="/repo"
          filePath="src/features/Main.java"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onRevealInFileTree={onRevealInFileTree}
          onAssociateIntentCanvasCodeAnchor={onAssociateIntentCanvasCodeAnchor}
          onActiveCodeAnchorChange={onActiveCodeAnchorChange}
          onClose={vi.fn()}
        />,
      );

      const editor = (await screen.findByTestId(
        "mock-codemirror",
      )) as HTMLTextAreaElement;
      fireEvent.keyDown(editor, { key: "F1", altKey: true });
      expect(onRevealInFileTree).toHaveBeenCalledWith("src/features/Main.java");

      fireEvent.keyDown(document.body, { key: "F1", altKey: true });
      expect(onRevealInFileTree).toHaveBeenCalledOnce();

      editor.setSelectionRange(0, 5);
      fireEvent.select(editor);
      await waitFor(() => {
        expect(onActiveCodeAnchorChange).toHaveBeenLastCalledWith(
          expect.objectContaining({ filePath: "src/features/Main.java" }),
        );
      });
      fireEvent.keyDown(editor, { key: "c", altKey: true, shiftKey: true });
      expect(onAssociateIntentCanvasCodeAnchor).toHaveBeenCalledOnce();

      fireEvent.keyDown(editor, { key: "p", altKey: true, shiftKey: true });
      await waitFor(() => {
        expect(document.querySelector(".fvp-code-preview")).toBeTruthy();
      });
    });

  it("opens a specific file tab in the detached explorer without activating or closing it", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "class Main {}",
        truncated: false,
      });
      const onActivateTab = vi.fn();
      const onCloseTab = vi.fn();

      render(
        <FileViewPanel
          workspaceId="ws-tab-detached"
          workspaceName="mossx"
          workspacePath="/repo"
          gitRoot="/repo"
          filePath="src/Main.java"
          openTabs={["src/Main.java", "src/Foo.java"]}
          activeTabPath="src/Main.java"
          onActivateTab={onActivateTab}
          onCloseTab={onCloseTab}
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await screen.findByTestId("mock-codemirror");
      const detachedButtons = screen.getAllByRole("button", {
        name: "files.openDetachedTabFor",
      });
      fireEvent.click(detachedButtons[1]);

      await waitFor(() => {
        expect(mockOpenNewDetachedFileExplorerWindow).toHaveBeenCalledWith(
          expect.objectContaining({
            workspaceId: "ws-tab-detached",
            workspaceName: "mossx",
            workspacePath: "/repo",
            gitRoot: "/repo",
            initialFilePath: "src/Foo.java",
            defaultSidebarCollapsed: true,
          }),
        );
      });
      expect(onActivateTab).not.toHaveBeenCalled();
      expect(onCloseTab).not.toHaveBeenCalled();
    });

  it("targets the invoked background tab and renders icons for root actions", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "class Main {}",
        truncated: false,
      });
      const onCloseTab = vi.fn();
      const onActivateTab = vi.fn();

      render(
        <FileViewPanel
          workspaceId="ws-tab-menu"
          workspacePath="/repo"
          filePath="src/Main.java"
          openTabs={["src/Main.java", "src/Foo.java"]}
          activeTabPath="src/Main.java"
          onActivateTab={onActivateTab}
          onCloseTab={onCloseTab}
          onCloseOtherTabs={vi.fn()}
          onCloseAllTabs={vi.fn()}
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await screen.findByTestId("mock-codemirror");
      fireEvent.contextMenu(screen.getByRole("tab", { name: "Foo.java" }), {
        clientX: 120,
        clientY: 80,
      });

      const menu = screen.getByRole("menu", { name: "files.tabContextMenu" });
      expect(
        menu.querySelectorAll(
          ":scope > .renderer-context-menu-item .renderer-context-menu-item-icon",
        ),
      ).toHaveLength(5);
      fireEvent.click(
        within(menu).getByRole("menuitem", { name: "files.closeCurrentTab" }),
      );
      expect(onCloseTab).toHaveBeenCalledWith("src/Foo.java");
    });

  it("disables close-other for a single file tab", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "class Main {}",
        truncated: false,
      });

      render(
        <FileViewPanel
          workspaceId="ws-single-tab-menu"
          workspacePath="/repo"
          filePath="src/Main.java"
          openTabs={["src/Main.java"]}
          activeTabPath="src/Main.java"
          onCloseTab={vi.fn()}
          onCloseOtherTabs={vi.fn()}
          onCloseAllTabs={vi.fn()}
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await screen.findByTestId("mock-codemirror");
      fireEvent.contextMenu(screen.getByRole("tab", { name: "Main.java" }));
      expect(
        (
          screen.getByRole("menuitem", {
            name: "files.closeOtherTabs",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
    });

  it("opens the invoked background tab from the context menu in a detached window", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "class Main {}",
        truncated: false,
      });

      render(
        <FileViewPanel
          workspaceId="ws-context-detached"
          workspaceName="mossx"
          workspacePath="/repo"
          filePath="src/Main.java"
          openTabs={["src/Main.java", "src/Foo.java"]}
          activeTabPath="src/Main.java"
          onCloseAllTabs={vi.fn()}
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await screen.findByTestId("mock-codemirror");
      fireEvent.contextMenu(screen.getByRole("tab", { name: "Foo.java" }));
      fireEvent.click(
        screen.getByRole("menuitem", { name: "files.openDetachedTab" }),
      );

      await waitFor(() => {
        expect(mockOpenNewDetachedFileExplorerWindow).toHaveBeenCalledWith(
          expect.objectContaining({ initialFilePath: "src/Foo.java" }),
        );
      });
    });

  it("prefers provided highlight markers over workspace git diff fetch", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "line 1\nline 2\nline 3",
        truncated: false,
      });

      render(
        <FileViewPanel
          workspaceId="ws-highlight"
          workspacePath="/repo"
          filePath="src/Main.java"
          gitStatusFiles={[
            { path: "src/Main.java", status: "M", additions: 1, deletions: 1 },
          ]}
          highlightMarkers={{ added: [2], modified: [3] }}
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await screen.findByTestId("mock-codemirror");
      await waitFor(() => {
        expect(getGitFileFullDiff).not.toHaveBeenCalled();
        expect(mockCodeMirrorDispatch).toHaveBeenCalledWith(
          expect.objectContaining({
            effects: expect.anything(),
          }),
        );
      });
    });

  it("loads workspace git diff after blame is enabled when provided highlight markers are empty", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "line 1\nline 2\nline 3",
        truncated: false,
      });
      vi.mocked(getGitFileFullDiff).mockResolvedValue(
        "@@ -1,0 +1,3 @@\n+line 1\n+line 2\n+line 3",
      );

      render(
        <FileViewPanel
          workspaceId="ws-highlight-empty"
          workspacePath="/repo"
          filePath="src/Main.java"
          gitStatusFiles={[
            { path: "src/Main.java", status: "M", additions: 3, deletions: 0 },
          ]}
          highlightMarkers={{ added: [], modified: [] }}
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await screen.findByTestId("mock-codemirror");
      expect(getGitFileFullDiff).not.toHaveBeenCalled();
      toggleFileGitBlame();
      await waitFor(() => {
        expect(getGitFileFullDiff).toHaveBeenCalledWith(
          "ws-highlight-empty",
          "src/Main.java",
        );
      });
    });
});
