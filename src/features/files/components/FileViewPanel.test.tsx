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

describe("editor annotation widget ordering", () => {
  it("keeps draft and existing markers sorted for CodeMirror ranges", () => {
      const targets = resolveEditorAnnotationWidgetOrder({
        maxLine: 50,
        annotations: [
          {
            id: "later-marker",
            path: "src/App.tsx",
            lineRange: { startLine: 38, endLine: 38 },
            body: "later",
            source: "file-edit-mode",
          },
          {
            id: "same-line-marker",
            path: "src/App.tsx",
            lineRange: { startLine: 12, endLine: 12 },
            body: "same line",
            source: "file-edit-mode",
          },
        ],
        draft: {
          lineRange: { startLine: 10, endLine: 12 },
          source: "file-edit-mode",
          body: "",
        },
      });

      expect(
        targets.map((target) =>
          target.kind === "marker"
            ? `${target.kind}:${target.annotation.id}:${target.targetLine}:${target.side}`
            : `${target.kind}:draft:${target.targetLine}:${target.side}`,
        ),
      ).toEqual([
        "marker:same-line-marker:12:1",
        "draft:draft:12:2",
        "marker:later-marker:38:1",
      ]);
    });
});
