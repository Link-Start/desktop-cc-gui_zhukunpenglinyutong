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

describe("FileViewPanel markdown modes", () => {
  afterEach(() => {
      cleanup();
      vi.clearAllMocks();
    });

  it("keeps the main-window fixed sample matrix on one render-profile-driven chain", async () => {
      const sampleContentByPath: Record<string, string> = {
        "README.md": ["# Workspace title", "", "- item"].join("\n"),
        Dockerfile: ["# build image", "FROM node:20-alpine", "WORKDIR /app"].join(
          "\n",
        ),
        "docker-compose.yml": [
          "services:",
          "  app:",
          "    image: mossx:dev",
        ].join("\n"),
        ".env.local": [
          "# local overrides",
          "APP_ENV=dev",
          "API_BASE=http://localhost:3000",
        ].join("\n"),
        "build.gradle.kts": [
          "// gradle setup",
          "plugins {",
          '  kotlin("jvm") version "1.9.24"',
          "}",
        ].join("\n"),
      };

      vi.mocked(readWorkspaceFile).mockImplementation(
        async (_workspaceId, path) => ({
          content: sampleContentByPath[path] ?? `missing:${path}`,
          truncated: false,
        }),
      );

      const openTabs = [
        "README.md",
        "Dockerfile",
        "docker-compose.yml",
        ".env.local",
        "build.gradle.kts",
      ];
      const baseProps = {
        workspaceId: "ws-main-matrix",
        workspacePath: "/repo",
        openTargets: [] as Parameters<typeof FileViewPanel>[0]["openTargets"],
        openAppIconById: {},
        selectedOpenAppId: "",
        onSelectOpenAppId: vi.fn(),
        onClose: vi.fn(),
        openTabs,
      };
      const findCodeMirrorContaining = async (expectedContent: string) => {
        let editor: HTMLTextAreaElement | null = null;
        await waitFor(() => {
          editor = screen.getByTestId("mock-codemirror") as HTMLTextAreaElement;
          expect(editor.value).toContain(expectedContent);
        });
        return editor;
      };

      const { container, rerender } = render(
        <FileViewPanel
          {...baseProps}
          filePath="README.md"
          activeTabPath="README.md"
        />,
      );

      await screen.findByTestId("file-markdown-preview");
      expect(screen.queryByTestId("mock-codemirror")).toBeNull();

      clickFileContextMenuItem(/files\.edit/i);
      expect(
        ((await screen.findByTestId("mock-codemirror")) as HTMLTextAreaElement)
          .value,
      ).toBe(sampleContentByPath["README.md"]);

      rerender(
        <FileViewPanel
          {...baseProps}
          filePath="Dockerfile"
          activeTabPath="Dockerfile"
        />,
      );

      await findCodeMirrorContaining("FROM node:20-alpine");
      expect(screen.queryByText("Workspace title")).toBeNull();
      clickFileContextMenuItem(/files\.preview/i);
      await screen.findByTestId("file-structured-preview");

      rerender(
        <FileViewPanel
          {...baseProps}
          filePath="docker-compose.yml"
          activeTabPath="docker-compose.yml"
        />,
      );

      await findCodeMirrorContaining("services:");
      expect(screen.queryByTestId("file-structured-preview")).toBeNull();
      clickFileContextMenuItem(/files\.preview/i);
      await waitFor(() => {
        expect(container.querySelector(".fvp-code-preview")).toBeTruthy();
      });
      expect(screen.queryByTestId("file-markdown-preview")).toBeNull();

      rerender(
        <FileViewPanel
          {...baseProps}
          filePath=".env.local"
          activeTabPath=".env.local"
        />,
      );

      await findCodeMirrorContaining("APP_ENV=dev");
      expect(screen.queryByText("services:")).toBeNull();

      rerender(
        <FileViewPanel
          {...baseProps}
          filePath="build.gradle.kts"
          activeTabPath="build.gradle.kts"
        />,
      );

      await findCodeMirrorContaining('kotlin("jvm")');
      clickFileContextMenuItem(/files\.preview/i);
      await waitFor(() => {
        expect(container.querySelector(".fvp-code-preview")).toBeTruthy();
      });
      expect(screen.queryByTestId("file-markdown-preview")).toBeNull();
      expect(screen.queryByTestId("file-structured-preview")).toBeNull();
    });

  it("keeps structured preview only on the top-level preview path", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: [
          "# production image",
          "FROM node:20-alpine",
          "RUN pnpm install",
        ].join("\n"),
        truncated: false,
      });

      render(
        <FileViewPanel
          workspaceId="ws-docker-2"
          workspacePath="/repo"
          filePath="Dockerfile"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await screen.findByTestId("mock-codemirror");
      clickFileContextMenuItem(/files\.preview/i);

      await screen.findByTestId("file-structured-preview");
      expect(screen.getByText("FROM")).toBeTruthy();
      expect(screen.getByText("node:20-alpine")).toBeTruthy();
    });

  it("falls back to low-cost code preview for truncated structured files", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: [
          "# production image",
          "FROM node:20-alpine",
          "RUN pnpm install",
        ].join("\n"),
        truncated: true,
      });

      const { container } = render(
        <FileViewPanel
          workspaceId="ws-docker-low-cost"
          workspacePath="/repo"
          filePath="Dockerfile"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await screen.findByTestId("mock-codemirror");
      clickFileContextMenuItem(/files\.preview/i);

      await waitFor(() => {
        expect(container.querySelector(".fvp-code-preview")).toBeTruthy();
      });
      expect(screen.queryByTestId("file-structured-preview")).toBeNull();
    });

  it("does not add structured edit tabs for regular code files", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "export const value = 1;",
        truncated: false,
      });

      render(
        <FileViewPanel
          workspaceId="ws-code-1"
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
      expect(screen.queryByRole("tab", { name: "Code" })).toBeNull();
      expect(screen.queryByRole("tab", { name: "Render" })).toBeNull();
    });

  it("opens log-like files on the existing text preview path", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "[INFO] started\n[ERROR] failed",
        truncated: false,
      });

      const { container, rerender } = render(
        <FileViewPanel
          workspaceId="ws-log-1"
          workspacePath="/repo"
          filePath="logs/app.log"
          initialMode="preview"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await waitFor(() => {
        expect(container.querySelector(".fvp-code-preview")).toBeTruthy();
      });
      expect(screen.queryByText(/unsupportedFormat/i)).toBeNull();
      expect(screen.queryByTestId("file-markdown-preview")).toBeNull();

      rerender(
        <FileViewPanel
          workspaceId="ws-log-1"
          workspacePath="/repo"
          filePath="logs/worker.trace"
          initialMode="preview"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await waitFor(() => {
        expect(container.querySelector(".fvp-code-preview")).toBeTruthy();
      });

      rerender(
        <FileViewPanel
          workspaceId="ws-log-1"
          workspacePath="/repo"
          filePath="logs/stderr.err"
          initialMode="preview"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await waitFor(() => {
        expect(container.querySelector(".fvp-code-preview")).toBeTruthy();
      });

      rerender(
        <FileViewPanel
          workspaceId="ws-log-1"
          workspacePath="/repo"
          filePath="logs/server.out"
          initialMode="preview"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await waitFor(() => {
        expect(container.querySelector(".fvp-code-preview")).toBeTruthy();
      });
    });
});
