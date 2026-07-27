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

describe("FileViewPanel image preview", () => {
  afterEach(() => {
      cleanup();
      vi.clearAllMocks();
      vi.unstubAllGlobals();
      mockCodeMirrorDispatch.mockReset();
    });

  it("prefers backend data URLs for local image preview", async () => {
      vi.mocked(readLocalImageDataUrl).mockResolvedValue(
        "data:image/png;base64,abc123",
      );
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: true,
          blob: async () => new Blob(["image-bytes"], { type: "image/png" }),
        })),
      );

      render(
        <FileViewPanel
          workspaceId="ws-image"
          workspacePath="/repo"
          filePath=".moss-x-gemini-inline-images/shot.png"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      const image = await screen.findByRole("img", {
        name: ".moss-x-gemini-inline-images/shot.png",
      });

      expect(vi.mocked(readLocalImageDataUrl)).toHaveBeenCalledWith(
        "ws-image",
        "/repo/.moss-x-gemini-inline-images/shot.png",
      );
      expect(image.getAttribute("src")).toBe("data:image/png;base64,abc123");
    });

  it("falls back to asset URLs when backend image data URL is unavailable", async () => {
      vi.mocked(readLocalImageDataUrl).mockResolvedValue(null);
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: true,
          blob: async () => new Blob(["image-bytes"], { type: "image/png" }),
        })),
      );

      render(
        <FileViewPanel
          workspaceId="ws-image-fallback"
          workspacePath="/repo"
          filePath="assets/shot.png"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      const image = await screen.findByRole("img", { name: "assets/shot.png" });

      expect(image.getAttribute("src")).toBe(
        "asset://localhost//repo/assets/shot.png",
      );
    });
});
