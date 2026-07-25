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

  it("opens markdown in preview mode by default", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "# Hello",
        truncated: false,
      });

      const { container } = render(
        <FileViewPanel
          workspaceId="ws-md-1"
          workspacePath="/repo"
          filePath="README.md"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await waitFor(() => {
        expect(container.querySelector(".fvp-preview-scroll")).toBeTruthy();
        expect(screen.getByTestId("file-markdown-preview")).toBeTruthy();
        expect(screen.queryByTestId("mock-codemirror")).toBeNull();
      });
    });

  it("exposes a visible edit toggle for markdown preview", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "# Hello",
        truncated: false,
      });

      render(
        <FileViewPanel
          workspaceId="ws-md-edit-toggle"
          workspacePath="/repo"
          filePath="CHANGELOG.md"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await screen.findByTestId("file-markdown-preview");
      fireEvent.click(screen.getByRole("button", { name: "files.edit" }));

      await screen.findByTestId("mock-codemirror");
      expect(screen.getByRole("button", { name: "files.preview" })).toBeTruthy();
      expect(vi.mocked(readWorkspaceFile)).toHaveBeenCalledTimes(1);
    });

  it("falls back to low-cost code preview for truncated markdown files", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "# Hello\n" + "body\n".repeat(32),
        truncated: true,
      });

      const { container } = render(
        <FileViewPanel
          workspaceId="ws-md-low-cost"
          workspacePath="/repo"
          filePath="README.md"
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

  it("keeps large markdown on the low-cost preview path across preview edit switches", async () => {
      const oversizedMarkdown = [
        "# Oversized README",
        ...Array.from(
          { length: 220 },
          (_, index) => `- ${index}: ${"x".repeat(900)}`,
        ),
      ].join("\n");
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: oversizedMarkdown,
        truncated: false,
      });

      const { container } = render(
        <FileViewPanel
          workspaceId="ws-md-budget"
          workspacePath="/repo"
          filePath="README.md"
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
      expect(vi.mocked(readWorkspaceFile)).toHaveBeenCalledTimes(1);

      clickFileContextMenuItem(/files\.edit/i);
      expect(
        ((await screen.findByTestId("mock-codemirror")) as HTMLTextAreaElement)
          .value,
      ).toContain("# Oversized README");

      clickFileContextMenuItem(/files\.preview/i);
      await waitFor(() => {
        expect(container.querySelector(".fvp-code-preview")).toBeTruthy();
      });
      expect(vi.mocked(readWorkspaceFile)).toHaveBeenCalledTimes(1);
    });

  it("toggles markdown preview and preserves edits", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "# Start",
        truncated: false,
      });

      const { container } = render(
        <FileViewPanel
          workspaceId="ws-md-2"
          workspacePath="/repo"
          filePath="README.md"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      clickFileContextMenuItem(/files\.edit/i);

      const editor = (await screen.findByTestId(
        "mock-codemirror",
      )) as HTMLTextAreaElement;
      fireEvent.change(editor, { target: { value: "# Updated" } });

      clickFileContextMenuItem(/files\.preview/i);

      await waitFor(() => {
        expect(container.querySelector(".fvp-preview-scroll")).toBeTruthy();
        expect(screen.getByTestId("file-markdown-preview")).toBeTruthy();
        expect(screen.getByText("Updated")).toBeTruthy();
      });

      clickFileContextMenuItem(/files\.edit/i);

      const updatedEditor = (await screen.findByTestId(
        "mock-codemirror",
      )) as HTMLTextAreaElement;
      expect(updatedEditor.value).toBe("# Updated");
    });

  it("creates markdown preview annotations as logical composer context without writing the file", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: ["# Title", "", "body", "tail"].join("\n"),
        truncated: false,
      });
      const onCreateCodeAnnotation = vi.fn();

      render(
        <FileViewPanel
          workspaceId="ws-md-annotation-preview"
          workspacePath="/repo"
          filePath="docs/guide.md"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
          onCreateCodeAnnotation={onCreateCodeAnnotation}
        />,
      );

      const preview = await screen.findByTestId("file-markdown-preview");
      expect(
        preview.querySelector(".fvp-markdown-source-annotation-list"),
      ).toBeNull();
      expect(screen.getByRole("heading", { name: "Title" })).toBeTruthy();
      await screen.findByRole("button", { name: "Show outline" });

      fireEvent.click(
        screen.getByRole("button", { name: /files\.annotateForAi L3/i }),
      );
      fireEvent.change(
        screen.getByPlaceholderText(/files\.annotationPlaceholder/i),
        {
          target: { value: "请检查标题和正文是否一致" },
        },
      );
      fireEvent.click(
        screen.getByRole("button", { name: /files\.annotationSubmit/i }),
      );

      expect(onCreateCodeAnnotation).toHaveBeenCalledWith({
        path: "docs/guide.md",
        lineRange: { startLine: 3, endLine: 4 },
        body: "请检查标题和正文是否一致",
        source: "file-preview-mode",
      });
      expect(writeWorkspaceFile).not.toHaveBeenCalled();
      expect(writeExternalSpecFile).not.toHaveBeenCalled();
    });

  it("keeps markdown annotation source lines stable after math normalization", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: [
          "# Math",
          "",
          "$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$",
          "",
          "target paragraph",
        ].join("\n"),
        truncated: false,
      });
      const onCreateCodeAnnotation = vi.fn();

      render(
        <FileViewPanel
          workspaceId="ws-md-annotation-math-lines"
          workspacePath="/repo"
          filePath="docs/math.md"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
          onCreateCodeAnnotation={onCreateCodeAnnotation}
        />,
      );

      await screen.findByTestId("file-markdown-preview");
      fireEvent.click(
        screen.getByRole("button", { name: /files\.annotateForAi L5/i }),
      );
      fireEvent.change(
        screen.getByPlaceholderText(/files\.annotationPlaceholder/i),
        {
          target: { value: "check target" },
        },
      );
      fireEvent.click(
        screen.getByRole("button", { name: /files\.annotationSubmit/i }),
      );

      expect(onCreateCodeAnnotation).toHaveBeenCalledWith({
        path: "docs/math.md",
        lineRange: { startLine: 5, endLine: 5 },
        body: "check target",
        source: "file-preview-mode",
      });
    });

  it("keeps markdown annotation typing local until submit to avoid sticky repeated input", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: ["# Title", "", "body", "tail"].join("\n"),
        truncated: false,
      });
      const onCreateCodeAnnotation = vi.fn();

      const { rerender } = render(
        <FileViewPanel
          workspaceId="ws-md-annotation-local-draft"
          workspacePath="/repo"
          filePath="docs/guide.md"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
          onCreateCodeAnnotation={onCreateCodeAnnotation}
        />,
      );

      await screen.findByTestId("file-markdown-preview");
      fireEvent.click(
        screen.getByRole("button", { name: /files\.annotateForAi L3/i }),
      );

      const input = screen.getByPlaceholderText(/files\.annotationPlaceholder/i);
      fireEvent.change(input, { target: { value: "hao" } });
      fireEvent.change(input, { target: { value: "haoni" } });
      fireEvent.change(input, { target: { value: "haoni abc" } });

      expect((input as HTMLTextAreaElement).value).toBe("haoni abc");
      expect(onCreateCodeAnnotation).not.toHaveBeenCalled();

      rerender(
        <FileViewPanel
          workspaceId="ws-md-annotation-local-draft"
          workspacePath="/repo"
          filePath="docs/guide.md"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
          onCreateCodeAnnotation={onCreateCodeAnnotation}
        />,
      );
      const inputAfterRerender = screen.getByPlaceholderText(
        /files\.annotationPlaceholder/i,
      );
      expect((inputAfterRerender as HTMLTextAreaElement).value).toBe("haoni abc");
      expect(
        screen.getAllByPlaceholderText(/files\.annotationPlaceholder/i),
      ).toHaveLength(1);

      fireEvent.click(
        screen.getByRole("button", { name: /files\.annotationSubmit/i }),
      );

      expect(onCreateCodeAnnotation).toHaveBeenCalledWith({
        path: "docs/guide.md",
        lineRange: { startLine: 3, endLine: 4 },
        body: "haoni abc",
        source: "file-preview-mode",
      });
    });

  it("isolates markdown annotation input from composition and file shortcuts", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: ["# Title", "", "body", "tail"].join("\n"),
        truncated: false,
      });
      vi.mocked(writeWorkspaceFile).mockResolvedValue();
      const onCreateCodeAnnotation = vi.fn();

      render(
        <FileViewPanel
          workspaceId="ws-md-annotation-input-island"
          workspacePath="/repo"
          filePath="docs/guide.md"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
          onCreateCodeAnnotation={onCreateCodeAnnotation}
        />,
      );

      await screen.findByTestId("file-markdown-preview");
      fireEvent.click(
        screen.getByRole("button", { name: /files\.annotateForAi L3/i }),
      );

      const input = screen.getByPlaceholderText(
        /files\.annotationPlaceholder/i,
      ) as HTMLTextAreaElement;
      fireEvent.compositionStart(input);
      fireEvent.change(input, { target: { value: "zhe" } });
      fireEvent.change(input, { target: { value: "这个" } });
      fireEvent.compositionEnd(input, { data: "这个" });
      fireEvent.change(input, { target: { value: "这个公式不对" } });
      input.focus();
      input.setSelectionRange(6, 6);
      fireEvent.keyDown(input, { key: "s", metaKey: true });
      fireEvent.keyDown(input, { key: "f", metaKey: true });

      expect(input.value).toBe("这个公式不对");
      expect(input.selectionStart).toBe(6);
      expect(writeWorkspaceFile).not.toHaveBeenCalled();
      expect(screen.queryByTestId("mock-codemirror")).toBeNull();

      fireEvent.click(
        screen.getByRole("button", { name: /files\.annotationSubmit/i }),
      );

      expect(
        screen.queryByPlaceholderText(/files\.annotationPlaceholder/i),
      ).toBeNull();
      expect(onCreateCodeAnnotation).toHaveBeenCalledWith({
        path: "docs/guide.md",
        lineRange: { startLine: 3, endLine: 4 },
        body: "这个公式不对",
        source: "file-preview-mode",
      });
    });

  it("renders markdown list annotation draft only once for nested blocks", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: [
          "## STEP4: 综合计算",
          "",
          "- 用各竞品历史份额乘以本品相对竞争力系数，推导本品份额。",
          "- 再乘以竞争价格带市场规模。",
          "- 再乘以上市爬坡因子，得到首年销量预测。",
        ].join("\n"),
        truncated: false,
      });

      render(
        <FileViewPanel
          workspaceId="ws-md-annotation-nested-list-draft"
          workspacePath="/repo"
          filePath="docs/guide.md"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
          onCreateCodeAnnotation={vi.fn()}
        />,
      );

      await screen.findByTestId("file-markdown-preview");
      fireEvent.click(
        screen.getByRole("button", { name: /files\.annotateForAi L3-L5/i }),
      );

      expect(
        screen.getAllByPlaceholderText(/files\.annotationPlaceholder/i),
      ).toHaveLength(1);
      expect(document.querySelectorAll(".fvp-annotation-draft")).toHaveLength(1);
    });

  it("renders markdown list annotation marker only once for nested blocks", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: [
          "## STEP4: 综合计算",
          "",
          "- 用各竞品历史份额乘以本品相对竞争力系数，推导本品份额。",
          "- 再乘以竞争价格带市场规模。",
          "- 再乘以上市爬坡因子，得到首年销量预测。",
        ].join("\n"),
        truncated: false,
      });

      render(
        <FileViewPanel
          workspaceId="ws-md-annotation-nested-list-marker"
          workspacePath="/repo"
          filePath="docs/guide.md"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
          codeAnnotations={[
            {
              id: "annotation-list",
              path: "docs/guide.md",
              lineRange: { startLine: 3, endLine: 5 },
              body: "列表只渲染一次",
              source: "file-preview-mode",
            },
          ]}
        />,
      );

      await screen.findByTestId("file-markdown-preview");

      expect(document.querySelectorAll(".fvp-annotation-marker")).toHaveLength(1);
      expect(screen.getByText("列表只渲染一次")).toBeTruthy();
    });
});
