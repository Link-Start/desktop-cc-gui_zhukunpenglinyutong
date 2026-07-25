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

  it("renders mermaid blocks lazily with per-block tabs", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "```mermaid\ngraph TD\nA-->B\n```",
        truncated: false,
      });
      mermaidInitialize.mockClear();
      mermaidRender.mockClear();

      render(
        <FileViewPanel
          workspaceId="ws-md-4"
          workspacePath="/repo"
          filePath="README.md"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await screen.findByTestId("file-markdown-preview");
      expect(
        screen.getByRole("tab", { name: "Source" }).getAttribute("aria-selected"),
      ).toBe("true");
      expect(mermaidRender).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("tab", { name: "Render" }));

      await waitFor(() => {
        expect(screen.getByTestId("file-markdown-mermaid-preview")).toBeTruthy();
        expect(mermaidRender).toHaveBeenCalledTimes(1);
      });
    });

  it("keeps mermaid rendered view after the same markdown preview remounts", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "```mermaid\ngraph TD\nA-->B\n```",
        truncated: false,
      });
      mermaidInitialize.mockClear();
      mermaidRender.mockClear();

      const panelProps = {
        workspaceId: "ws-md-mermaid-stable",
        workspacePath: "/repo",
        filePath: "README.md",
        openTargets: [] as Parameters<typeof FileViewPanel>[0]["openTargets"],
        openAppIconById: {},
        selectedOpenAppId: "",
        onSelectOpenAppId: vi.fn(),
        onClose: vi.fn(),
      };

      const { rerender } = render(
        <FileViewPanel key="stable-mermaid-before" {...panelProps} />,
      );

      await screen.findByTestId("file-markdown-preview");
      fireEvent.click(screen.getByRole("tab", { name: "Render" }));
      await screen.findByTestId("file-markdown-mermaid-preview");
      expect(
        screen.getByRole("tab", { name: "Render" }).getAttribute("aria-selected"),
      ).toBe("true");

      rerender(<FileViewPanel key="stable-mermaid-after" {...panelProps} />);

      await screen.findByTestId("file-markdown-mermaid-preview");
      expect(
        screen.getByRole("tab", { name: "Render" }).getAttribute("aria-selected"),
      ).toBe("true");
      expect(
        screen.getByRole("tab", { name: "Source" }).getAttribute("aria-selected"),
      ).toBe("false");
      expect(mermaidRender).toHaveBeenCalledTimes(1);
    });

  it("renders markdown math formulas while keeping mermaid blocks lazy", async () => {
      await loadKatexAssets();
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: [
          "行内公式：$E=mc^2$。",
          "",
          "块级公式：",
          "",
          "$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$",
          "",
          "```mermaid",
          "graph TD",
          "A-->B",
          "```",
        ].join("\n"),
        truncated: false,
      });
      mermaidInitialize.mockClear();
      mermaidRender.mockClear();

      const { container } = render(
        <FileViewPanel
          workspaceId="ws-md-math"
          workspacePath="/repo"
          filePath="docs/math.md"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await screen.findByTestId("file-markdown-preview");
      await waitFor(() => {
        expect(container.querySelector(".fvp-file-markdown .katex")).toBeTruthy();
        expect(
          container.querySelector(".fvp-file-markdown .katex-display"),
        ).toBeTruthy();
        expect(
          container.querySelector(".fvp-file-markdown .katex-error"),
        ).toBeFalsy();
      });
      expect(mermaidRender).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("tab", { name: "Render" }));
      await screen.findByTestId("file-markdown-mermaid-preview");
      expect(mermaidRender).toHaveBeenCalledTimes(1);
    });

  it("renders fenced math blocks as katex display formulas", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: [
          "## 块级公式",
          "",
          "```math",
          "\\int_{-\\infty}^{+\\infty} e^{-x^2} dx = \\sqrt{\\pi}",
          "```",
          "",
          "```latex",
          "A = \\begin{bmatrix}",
          "1 & 2 & 3 \\\\",
          "4 & 5 & 6 \\\\",
          "7 & 8 & 9",
          "\\end{bmatrix}",
          "```",
        ].join("\n"),
        truncated: false,
      });

      const { container } = render(
        <FileViewPanel
          workspaceId="ws-md-fenced-math"
          workspacePath="/repo"
          filePath="docs/math.md"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await screen.findByTestId("file-markdown-preview");
      await waitFor(() => {
        expect(
          container.querySelectorAll(".fvp-file-markdown .katex-display").length,
        ).toBe(2);
      });
      expect(screen.queryByText("math")).toBeNull();
      expect(screen.queryByText("latex")).toBeNull();
    });

  it("resets markdown renderer state when switching to another markdown file", async () => {
      vi.mocked(readWorkspaceFile).mockImplementation(
        async (_workspaceId, path) => ({
          content:
            path === "README.md"
              ? "```mermaid\ngraph TD\nA-->B\n```"
              : "# Guide\n\nFresh body",
          truncated: false,
        }),
      );
      mermaidInitialize.mockClear();
      mermaidRender.mockClear();

      const baseProps = {
        workspaceId: "ws-md-switch",
        workspacePath: "/repo",
        openTargets: [] as Parameters<typeof FileViewPanel>[0]["openTargets"],
        openAppIconById: {},
        selectedOpenAppId: "",
        onSelectOpenAppId: vi.fn(),
        onClose: vi.fn(),
      };

      const { rerender } = render(
        <FileViewPanel {...baseProps} filePath="README.md" />,
      );

      await screen.findByTestId("file-markdown-preview");
      fireEvent.click(screen.getByRole("tab", { name: "Render" }));
      await screen.findByTestId("file-markdown-mermaid-preview");
      expect(mermaidRender).toHaveBeenCalledTimes(1);

      rerender(<FileViewPanel {...baseProps} filePath="docs/guide.md" />);

      await screen.findByTestId("file-markdown-preview");
      expect(screen.getByText("Guide")).toBeTruthy();
      expect(screen.queryByTestId("file-markdown-mermaid-preview")).toBeNull();
      expect(screen.queryByRole("tab", { name: "Render" })).toBeNull();
      expect(screen.queryByText("A-->B")).toBeNull();
    });

  it("renders frontmatter metadata separately from markdown body", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: [
          "---",
          'name: "OpenSpec: New"',
          "calls_skill: openspec-new-change",
          "tags: [workflow, artifacts, experimental]",
          "---",
          "",
          "# Title",
          "",
          "正文内容",
        ].join("\n"),
        truncated: false,
      });

      render(
        <FileViewPanel
          workspaceId="ws-md-5"
          workspacePath="/repo"
          filePath="new.md"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await screen.findByTestId("file-markdown-preview");
      expect(screen.getByTestId("file-markdown-frontmatter")).toBeTruthy();
      expect(screen.getByText("OpenSpec: New")).toBeTruthy();
      expect(screen.getByText("openspec-new-change")).toBeTruthy();
      expect(
        screen.getByText("workflow · artifacts · experimental"),
      ).toBeTruthy();
      expect(screen.getByRole("heading", { name: "Title" })).toBeTruthy();
      expect(screen.queryByText(/^name: "OpenSpec: New"/)).toBeNull();
    });

  it("keeps non-markdown preview on the existing code preview path", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "export const value = 1;",
        truncated: false,
      });

      const { container } = render(
        <FileViewPanel
          workspaceId="ws-md-3"
          workspacePath="/repo"
          filePath="src/value.ts"
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
      expect(screen.queryByTestId("file-markdown-preview")).toBeNull();
    });

  it("reveals annotation action after selecting code preview lines", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: ["export const value = 1;", "export const next = 2;"].join("\n"),
        truncated: false,
      });
      const onCreateCodeAnnotation = vi.fn();

      const { container } = render(
        <FileViewPanel
          workspaceId="ws-code-preview-annotation"
          workspacePath="/repo"
          filePath="src/value.ts"
          initialMode="preview"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
          onCreateCodeAnnotation={onCreateCodeAnnotation}
        />,
      );

      await waitFor(() => {
        expect(container.querySelector(".fvp-code-preview")).toBeTruthy();
      });
      const lines = container.querySelectorAll<HTMLElement>(".fvp-code-line");
      fireEvent.click(lines[0]!);
      fireEvent.click(lines[1]!, { shiftKey: true });
      expect(screen.getByText("L1-L2")).toBeTruthy();

      const selectionToolbar = container.querySelector(
        ".fvp-preview-selection-toolbar",
      );
      expect(selectionToolbar).toBeTruthy();
      fireEvent.click(
        (selectionToolbar as HTMLElement).querySelector(
          ".fvp-annotation-trigger",
        ) as HTMLElement,
      );
      fireEvent.change(
        screen.getByPlaceholderText(/files\.annotationPlaceholder/i),
        {
          target: { value: "检查两行导出的命名是否一致" },
        },
      );
      fireEvent.click(
        screen.getByRole("button", { name: /files\.annotationSubmit/i }),
      );

      expect(onCreateCodeAnnotation).toHaveBeenCalledWith({
        path: "src/value.ts",
        lineRange: { startLine: 1, endLine: 2 },
        body: "检查两行导出的命名是否一致",
        source: "file-preview-mode",
      });
      expect(writeWorkspaceFile).not.toHaveBeenCalled();
      expect(writeExternalSpecFile).not.toHaveBeenCalled();
    });

  it("opens shell files in edit mode by default", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: [
          "#!/usr/bin/env bash",
          "",
          "# build app",
          "# with cached dependencies",
          "pnpm install --frozen-lockfile",
          "pnpm build",
        ].join("\n"),
        truncated: false,
      });

      render(
        <FileViewPanel
          workspaceId="ws-shell-1"
          workspacePath="/repo"
          filePath="scripts/build.sh"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      const editor = await screen.findByTestId("mock-codemirror");
      expect(editor).toBeTruthy();
      expect(screen.queryByTestId("file-structured-preview")).toBeNull();
    });

  it("keeps shell-group compatibility for zsh and dotfile scripts", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: [
          "#!/usr/bin/env zsh",
          "",
          "# setup env",
          "export APP_ENV=dev",
        ].join("\n"),
        truncated: false,
      });

      render(
        <FileViewPanel
          workspaceId="ws-shell-2"
          workspacePath="/repo"
          filePath=".envrc"
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
      expect(screen.getByText("setup env")).toBeTruthy();
      expect(screen.getByText("Commands")).toBeTruthy();
    });

  it("opens Dockerfile in edit mode by default", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: [
          "# production image",
          "FROM node:20-alpine",
          "WORKDIR /app",
          "COPY package.json pnpm-lock.yaml ./",
          "RUN pnpm install --frozen-lockfile \\",
          "  && pnpm store prune",
        ].join("\n"),
        truncated: false,
      });

      render(
        <FileViewPanel
          workspaceId="ws-docker-1"
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
      expect(screen.queryByTestId("file-structured-preview")).toBeNull();
    });

  it("switches file modes locally without extra workspace reads", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: ["# build image", "FROM node:20-alpine", "WORKDIR /app"].join(
          "\n",
        ),
        truncated: false,
      });

      render(
        <FileViewPanel
          workspaceId="ws-docker-local"
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
      expect(vi.mocked(readWorkspaceFile)).toHaveBeenCalledTimes(1);

      clickFileContextMenuItem(/files\.preview/i);
      await screen.findByTestId("file-structured-preview");

      clickFileContextMenuItem(/files\.edit/i);
      await screen.findByTestId("mock-codemirror");

      expect(vi.mocked(readWorkspaceFile)).toHaveBeenCalledTimes(1);
    });
});
