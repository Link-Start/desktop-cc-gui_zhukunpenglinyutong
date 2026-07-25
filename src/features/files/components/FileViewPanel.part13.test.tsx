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

describe("FileViewPanel editor theme selection", () => {
  afterEach(() => {
      cleanup();
      vi.clearAllMocks();
      delete document.documentElement.dataset.theme;
    });

  it("uses light theme when data-theme is light", async () => {
      document.documentElement.dataset.theme = "light";
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "console.log('hello');",
        truncated: false,
      });

      render(
        <FileViewPanel
          workspaceId="ws-theme-1"
          workspacePath="/repo"
          filePath="src/App.tsx"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      const editor = await screen.findByTestId("mock-codemirror");
      expect(editor.getAttribute("data-editor-theme")).toBe("light");
    });

  it("uses dark theme when data-theme is dark", async () => {
      document.documentElement.dataset.theme = "dark";
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "console.log('hello');",
        truncated: false,
      });

      render(
        <FileViewPanel
          workspaceId="ws-theme-2"
          workspacePath="/repo"
          filePath="src/App.tsx"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      const editor = await screen.findByTestId("mock-codemirror");
      expect(editor.getAttribute("data-editor-theme")).toBe("dark");
    });
});
