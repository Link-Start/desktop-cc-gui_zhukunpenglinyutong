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

  it("mounts the editor before slow git markers resolve", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "const value = 1;",
        truncated: false,
      });
      vi.mocked(getGitFileFullDiff).mockReturnValue(new Promise(() => undefined));

      render(
        <FileViewPanel
          workspaceId="ws-slow-git-marker"
          workspacePath="/repo"
          filePath="src/value.ts"
          gitStatusFiles={[
            { path: "src/value.ts", status: "M", additions: 1, deletions: 0 },
          ]}
          highlightMarkers={{ added: [], modified: [] }}
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await waitFor(() => {
        expect(
          (screen.getByTestId("mock-codemirror") as HTMLTextAreaElement).value,
        ).toBe("const value = 1;");
      });
      expect(getGitFileFullDiff).not.toHaveBeenCalled();
      toggleFileGitBlame();
      await waitFor(() => {
        expect(getGitFileFullDiff).toHaveBeenCalledWith(
          "ws-slow-git-marker",
          "src/value.ts",
        );
        expect(screen.getByTestId("mock-codemirror")).toBeTruthy();
      });
    });

  it("drops stale git marker results after switching files", async () => {
      let resolveDiff: (diff: string) => void = () => {};
      const pendingDiff = new Promise<string>((resolve) => {
        resolveDiff = resolve;
      });
      vi.mocked(readWorkspaceFile).mockImplementation(
        async (_workspaceId, path) => ({
          content: path === "src/A.ts" ? "const a = 1;\n" : "const b = 1;\n",
          truncated: false,
        }),
      );
      vi.mocked(getGitFileFullDiff).mockReturnValue(pendingDiff);

      const { rerender } = render(
        <FileViewPanel
          workspaceId="ws-stale-git-marker"
          workspacePath="/repo"
          filePath="src/A.ts"
          gitStatusFiles={[
            { path: "src/A.ts", status: "M", additions: 1, deletions: 0 },
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
      toggleFileGitBlame();
      await waitFor(() => expect(getGitFileFullDiff).toHaveBeenCalledTimes(1));
      mockCodeMirrorDispatch.mockClear();

      rerender(
        <FileViewPanel
          workspaceId="ws-stale-git-marker"
          workspacePath="/repo"
          filePath="src/B.ts"
          gitStatusFiles={[]}
          highlightMarkers={{ added: [], modified: [] }}
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await waitFor(() => {
        expect(readWorkspaceFile).toHaveBeenCalledWith(
          "ws-stale-git-marker",
          "src/B.ts",
        );
      });
      await waitFor(() => {
        expect(mockCodeMirrorDispatch.mock.calls.length).toBeGreaterThanOrEqual(
          2,
        );
      });
      mockCodeMirrorDispatch.mockClear();

      await act(async () => {
        resolveDiff("@@ -1,1 +1,2 @@\n const a = 1;\n+const stale = true;");
        await pendingDiff;
      });

      expect(mockCodeMirrorDispatch).not.toHaveBeenCalled();
    });

  it("normalizes absolute file paths before reading and fetching git diff", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "class Main {}\n",
        truncated: false,
      });
      vi.mocked(getGitFileFullDiff).mockResolvedValue(
        "@@ -1,1 +1,2 @@\n class Main {}\n+// changed",
      );

      render(
        <FileViewPanel
          workspaceId="ws-absolute-path"
          workspacePath="/repo"
          filePath="/repo/src/Main.java"
          gitStatusFiles={[
            { path: "src/Main.java", status: "M", additions: 1, deletions: 0 },
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
      toggleFileGitBlame();
      expect(readWorkspaceFile).toHaveBeenCalledWith(
        "ws-absolute-path",
        "src/Main.java",
      );
      await waitFor(() => {
        expect(getGitFileFullDiff).toHaveBeenCalledWith(
          "ws-absolute-path",
          "src/Main.java",
        );
      });
    });

  it("normalizes Windows absolute file paths case-insensitively before reading and fetching git diff", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "class Main {}\n",
        truncated: false,
      });
      vi.mocked(getGitFileFullDiff).mockResolvedValue(
        "@@ -1,1 +1,2 @@\n class Main {}\n+// changed",
      );

      render(
        <FileViewPanel
          workspaceId="ws-windows-absolute-path"
          workspacePath="C:/Users/Chen/Project"
          filePath="c:/users/chen/project/src/Main.java"
          gitStatusFiles={[
            { path: "src/Main.java", status: "M", additions: 1, deletions: 0 },
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
      toggleFileGitBlame();
      expect(readWorkspaceFile).toHaveBeenCalledWith(
        "ws-windows-absolute-path",
        "src/Main.java",
      );
      await waitFor(() => {
        expect(getGitFileFullDiff).toHaveBeenCalledWith(
          "ws-windows-absolute-path",
          "src/Main.java",
        );
      });
    });

  it("uses repo-relative git path for diff when git root is a workspace subdirectory", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "APP_HOST=0.0.0.0\n",
        truncated: false,
      });
      vi.mocked(getGitFileFullDiff).mockResolvedValue(
        "@@ -1,1 +1,2 @@\n-APP_HOST=0.0.0.0\n+APP_HOST=127.0.0.1",
      );

      const { container } = render(
        <FileViewPanel
          workspaceId="ws-subrepo"
          workspacePath="/tmp/JinSen"
          gitRoot="kmllm-search-showcar-py"
          filePath="kmllm-search-showcar-py/.env.example"
          gitStatusFiles={[
            { path: ".env.example", status: "M", additions: 1, deletions: 1 },
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
      toggleFileGitBlame();
      await waitFor(() => {
        expect(getGitFileFullDiff).toHaveBeenCalledWith(
          "ws-subrepo",
          ".env.example",
        );
      });
      expect(container.querySelector(".fvp-tab.is-active")?.className).toContain(
        "git-m",
      );
    });

  it("does not apply subrepo repo-relative git status to workspace root file with same relative path", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "# workspace root readme\n",
        truncated: false,
      });
      vi.mocked(getGitFileFullDiff).mockResolvedValue("");

      const { container } = render(
        <FileViewPanel
          workspaceId="ws-subrepo-root"
          workspacePath="/tmp/JinSen"
          gitRoot="kmllm-search-showcar-py"
          filePath="README.md"
          gitStatusFiles={[
            { path: "README.md", status: "M", additions: 1, deletions: 1 },
          ]}
          highlightMarkers={{ added: [], modified: [] }}
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await screen.findByTestId("file-markdown-preview");
      expect(getGitFileFullDiff).not.toHaveBeenCalled();
      expect(
        container.querySelector(".fvp-tab.is-active")?.className,
      ).not.toContain("git-m");
    });

  it("reads file content via external spec route when path is under custom spec root", async () => {
      vi.mocked(readExternalSpecFile).mockResolvedValue({
        exists: true,
        content: "# External tasks",
        truncated: false,
      });

      render(
        <FileViewPanel
          workspaceId="ws-external-read"
          workspacePath="/repo"
          customSpecRoot="/spec-root"
          filePath="/spec-root/changes/fix/tasks.md"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await screen.findByTestId("file-markdown-preview");
      expect(readExternalSpecFile).toHaveBeenCalledWith(
        "ws-external-read",
        "/spec-root",
        "openspec/changes/fix/tasks.md",
      );
      expect(readWorkspaceFile).not.toHaveBeenCalled();
    });

  it("writes file content via external spec route when editing file under custom spec root", async () => {
      vi.mocked(readExternalSpecFile).mockResolvedValue({
        exists: true,
        content: "line 1",
        truncated: false,
      });
      vi.mocked(writeExternalSpecFile).mockResolvedValue();

      render(
        <FileViewPanel
          workspaceId="ws-external-write"
          workspacePath="/repo"
          customSpecRoot="/spec-root"
          filePath="/spec-root/changes/fix/tasks.ts"
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
      fireEvent.change(editor, { target: { value: "line 2" } });
      clickFileContextMenuItem(/files\.save/i);

      await waitFor(() => {
        expect(writeExternalSpecFile).toHaveBeenCalledWith(
          "ws-external-write",
          "/spec-root",
          "openspec/changes/fix/tasks.ts",
          "line 2",
        );
      });
      expect(writeWorkspaceFile).not.toHaveBeenCalled();
    });

  it("reads file content via external absolute route when path is outside workspace and spec root", async () => {
      vi.mocked(readExternalAbsoluteFile).mockResolvedValue({
        content: "export const external = true;",
        truncated: false,
      });

      render(
        <FileViewPanel
          workspaceId="ws-external-absolute"
          workspacePath="/repo"
          customSpecRoot="/spec-root"
          filePath="/another-project/src/App.tsx"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await screen.findByTestId("mock-codemirror");
      expect(readExternalAbsoluteFile).toHaveBeenCalledWith(
        "ws-external-absolute",
        "/another-project/src/App.tsx",
      );
      expect(readWorkspaceFile).not.toHaveBeenCalled();
      expect(readExternalSpecFile).not.toHaveBeenCalled();
    });

  it("keeps external absolute files read-only on save", async () => {
      vi.mocked(readExternalAbsoluteFile).mockResolvedValue({
        content: "const a = 1;",
        truncated: false,
      });

      render(
        <FileViewPanel
          workspaceId="ws-external-absolute-save"
          workspacePath="/repo"
          customSpecRoot="/spec-root"
          filePath="/another-project/src/App.tsx"
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
      fireEvent.change(editor, { target: { value: "const a = 2;" } });
      fireEvent.keyDown(window, { key: "s", metaKey: true });

      await waitFor(() => {
        expect(writeWorkspaceFile).not.toHaveBeenCalled();
        expect(writeExternalSpecFile).not.toHaveBeenCalled();
      });
    });
});
