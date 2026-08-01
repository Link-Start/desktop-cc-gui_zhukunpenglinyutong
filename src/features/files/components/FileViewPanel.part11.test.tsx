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

describe("FileViewPanel document preview modes", () => {
  afterEach(() => {
      cleanup();
      vi.clearAllMocks();
    });

  it("routes pdf files into the dedicated pdf preview surface", async () => {
      render(
        <FileViewPanel
          workspaceId="ws-pdf"
          workspacePath="/repo"
          filePath="docs/report.pdf"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("pdf-preview")).toBeTruthy();
      });
      expect(screen.queryByTestId("mock-codemirror")).toBeNull();
      expect(screen.queryByRole("button", { name: /edit/i })).toBeNull();
    });

  it("routes docx files into the dedicated document preview surface", async () => {
      render(
        <FileViewPanel
          workspaceId="ws-docx"
          workspacePath="/repo"
          filePath="docs/report.docx"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("document-preview")).toBeTruthy();
      });
      expect(screen.queryByRole("button", { name: /edit/i })).toBeNull();
    });

  it("normalizes workspace absolute paths before passing preview payloads on Windows", async () => {
      render(
        <FileViewPanel
          workspaceId="ws-docx-win"
          workspacePath={"C:\\Repo"}
          filePath="docs/report.docx"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("document-preview")).toBeTruthy();
      });

      expect(vi.mocked(useFilePreviewPayload)).toHaveBeenCalledWith(
        expect.objectContaining({
          absolutePath: "C:/Repo/docs/report.docx",
        }),
      );
    });

  it("keeps csv on table preview by default but still allows plain-text edit", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "name,value\nalpha,1",
        truncated: false,
      });

      render(
        <FileViewPanel
          workspaceId="ws-csv"
          workspacePath="/repo"
          filePath="docs/report.csv"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("tabular-preview")).toBeTruthy();
      });

      clickFileContextMenuItem(/files\.edit/i);
      expect(await screen.findByTestId("mock-codemirror")).not.toBeNull();
    });
});
