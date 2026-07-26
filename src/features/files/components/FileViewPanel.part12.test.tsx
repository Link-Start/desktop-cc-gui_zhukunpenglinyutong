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

describe("FileViewPanel code preview viewport pipeline", () => {
  afterEach(() => {
      cleanup();
      vi.clearAllMocks();
    });

  it("uses virtualized rows for large code preview instead of mounting every line", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: Array.from(
          { length: 1_500 },
          (_, index) => `const value${index} = ${index};`,
        ).join("\n"),
        truncated: false,
      });

      const { container } = render(
        <FileViewPanel
          workspaceId="ws-code-virtual"
          workspacePath="/repo"
          filePath="src/large.ts"
          initialMode="preview"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await waitFor(() => {
        expect(
          container.querySelector(".fvp-code-preview.is-virtualized"),
        ).toBeTruthy();
      });
      expect(
        container
          .querySelector(".fvp-code-preview")
          ?.getAttribute("data-code-preview-line-count"),
      ).toBe("1500");
      expect(container.querySelectorAll(".fvp-code-line").length).toBeLessThan(
        1_500,
      );
    });
});
