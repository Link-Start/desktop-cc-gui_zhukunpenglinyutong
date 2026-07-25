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

  it("does not duplicate markdown annotations at the parent preview block", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: [
          "## STEP1: 市场规模拆解",
          "",
          "- 整体市场未来规模预测。",
          "- 紧凑型 SUV 未来规模预测。",
          "",
          "## STEP2: 竞品选择与竞争力系数",
          "",
          "- 基于配置相似度、价格重叠度，选取三个核心竞品。",
          "- 对比本品与三个核心竞品的核心竞争力系数，主要对比配置功能。",
          "",
          "## STEP3: 上市爬坡因子",
          "",
          "- 使用多年车型上市后的真实数据，拟合新车上市后的销量爬坡速度。",
          "",
          "## STEP4: 综合计算",
          "",
          "- 用各竞品历史份额乘以本品相对竞争力系数，推导本品份额。",
        ].join("\n"),
        truncated: false,
      });

      render(
        <FileViewPanel
          workspaceId="ws-md-annotation-parent-duplicate"
          workspacePath="/repo"
          filePath="docs/guide.md"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
          codeAnnotations={[
            {
              id: "annotation-step2",
              path: "docs/guide.md",
              lineRange: { startLine: 8, endLine: 8 },
              body: "1212",
              source: "file-preview-mode",
            },
            {
              id: "annotation-step3",
              path: "docs/guide.md",
              lineRange: { startLine: 13, endLine: 13 },
              body: "22222",
              source: "file-preview-mode",
            },
          ]}
        />,
      );

      await screen.findByTestId("file-markdown-preview");

      expect(document.querySelectorAll(".fvp-annotation-marker")).toHaveLength(2);
      expect(screen.getAllByText("1212")).toHaveLength(1);
      expect(screen.getAllByText("22222")).toHaveLength(1);
    });

  it("keeps annotation draft focus and cursor position after rerender", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: ["# Title", "", "body", "tail"].join("\n"),
        truncated: false,
      });

      const { rerender } = render(
        <FileViewPanel
          workspaceId="ws-md-annotation-focus"
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
        screen.getByRole("button", { name: /files\.annotateForAi L3/i }),
      );

      const input = screen.getByPlaceholderText(
        /files\.annotationPlaceholder/i,
      ) as HTMLTextAreaElement;
      fireEvent.change(input, { target: { value: "abcdef" } });
      input.focus();
      input.setSelectionRange(4, 4);
      fireEvent.keyUp(input, { key: "ArrowLeft" });

      rerender(
        <FileViewPanel
          workspaceId="ws-md-annotation-focus"
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

      const inputAfterRerender = screen.getByPlaceholderText(
        /files\.annotationPlaceholder/i,
      ) as HTMLTextAreaElement;
      expect(document.activeElement).toBe(inputAfterRerender);
      expect(inputAfterRerender.value).toBe("abcdef");
      expect(inputAfterRerender.selectionStart).toBe(4);
      expect(inputAfterRerender.selectionEnd).toBe(4);
    });

  it("does not steal focus back from the composer after annotation draft rerender", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: ["# Title", "", "body", "tail"].join("\n"),
        truncated: false,
      });

      const { rerender } = render(
        <>
          <FileViewPanel
            workspaceId="ws-md-annotation-no-focus-steal"
            workspacePath="/repo"
            filePath="docs/guide.md"
            openTargets={[]}
            openAppIconById={{}}
            selectedOpenAppId=""
            onSelectOpenAppId={vi.fn()}
            onClose={vi.fn()}
            onCreateCodeAnnotation={vi.fn()}
          />
          <textarea aria-label="composer input" />
        </>,
      );

      await screen.findByTestId("file-markdown-preview");
      fireEvent.click(
        screen.getByRole("button", { name: /files\.annotateForAi L3/i }),
      );

      const annotationInput = screen.getByPlaceholderText(
        /files\.annotationPlaceholder/i,
      ) as HTMLTextAreaElement;
      fireEvent.change(annotationInput, { target: { value: "abcdef" } });
      annotationInput.focus();
      annotationInput.setSelectionRange(4, 4);
      fireEvent.keyUp(annotationInput, { key: "ArrowLeft" });

      const composerInput = screen.getByLabelText("composer input");
      composerInput.focus();

      rerender(
        <>
          <FileViewPanel
            workspaceId="ws-md-annotation-no-focus-steal"
            workspacePath="/repo"
            filePath="docs/guide.md"
            openTargets={[]}
            openAppIconById={{}}
            selectedOpenAppId=""
            onSelectOpenAppId={vi.fn()}
            onClose={vi.fn()}
            onCreateCodeAnnotation={vi.fn()}
          />
          <textarea aria-label="composer input" />
        </>,
      );

      expect(document.activeElement).toBe(
        screen.getByLabelText("composer input"),
      );
      expect(
        (
          screen.getByPlaceholderText(
            /files\.annotationPlaceholder/i,
          ) as HTMLTextAreaElement
        ).value,
      ).toBe("abcdef");
    });

  it("renders confirmed preview annotations back near the marked lines", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: ["export const value = 1;", "export const next = 2;"].join("\n"),
        truncated: false,
      });

      const { container } = render(
        <FileViewPanel
          workspaceId="ws-code-preview-marker"
          workspacePath="/repo"
          filePath="src/value.ts"
          initialMode="preview"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
          codeAnnotations={[
            {
              id: "annotation-1",
              path: "src/value.ts",
              lineRange: { startLine: 2, endLine: 2 },
              body: "这里已经标记过",
              source: "file-preview-mode",
            },
          ]}
        />,
      );

      await waitFor(() => {
        expect(container.querySelector(".fvp-code-preview")).toBeTruthy();
      });
      const lines = container.querySelectorAll<HTMLElement>(".fvp-code-line");
      expect(
        lines[1]?.querySelector(".fvp-annotation-marker")?.textContent,
      ).toContain("这里已经标记过");
      expect(lines[0]?.querySelector(".fvp-annotation-marker")).toBeNull();
    });

  it("matches preview annotations with Windows path separators", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: ["# Title", "", "body"].join("\n"),
        truncated: false,
      });

      render(
        <FileViewPanel
          workspaceId="ws-md-annotation-windows-path"
          workspacePath="/repo"
          filePath="docs/guide.md"
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
          codeAnnotations={[
            {
              id: "annotation-windows-path",
              path: "docs\\guide.md",
              lineRange: { startLine: 3, endLine: 3 },
              body: "跨平台路径标注",
              source: "file-preview-mode",
            },
          ]}
        />,
      );

      await screen.findByTestId("file-markdown-preview");

      expect(document.querySelectorAll(".fvp-annotation-marker")).toHaveLength(1);
      expect(screen.getByText("跨平台路径标注")).toBeTruthy();
    });

  it("creates markdown edit annotations without requiring save", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: ["# Title", "", "body"].join("\n"),
        truncated: false,
      });
      const onCreateCodeAnnotation = vi.fn();
      const onActiveFileLineRangeChange = vi.fn();

      const { container, rerender } = render(
        <FileViewPanel
          workspaceId="ws-md-annotation-edit"
          workspacePath="/repo"
          filePath="docs/guide.md"
          activeFileLineRange={null}
          onActiveFileLineRangeChange={onActiveFileLineRangeChange}
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
          onCreateCodeAnnotation={onCreateCodeAnnotation}
        />,
      );

      await screen.findByTestId("file-markdown-preview");
      clickFileContextMenuItem(/files\.edit/i);
      await screen.findByTestId("mock-codemirror");

      rerender(
        <FileViewPanel
          workspaceId="ws-md-annotation-edit"
          workspacePath="/repo"
          filePath="docs/guide.md"
          activeFileLineRange={{ startLine: 2, endLine: 3 }}
          onActiveFileLineRangeChange={onActiveFileLineRangeChange}
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
          onCreateCodeAnnotation={onCreateCodeAnnotation}
        />,
      );

      expect(container.querySelector(".fvp-annotation-toolbar")).toBeNull();
      const footerAnnotationButton = container.querySelector(
        ".fvp-footer .fvp-file-reference-annotation",
      );
      expect(footerAnnotationButton).not.toBeNull();

      fireEvent.click(
        screen.getByRole("button", { name: /files\.annotateForAi/i }),
      );
      expect(screen.getAllByText("L2-L3").length).toBeGreaterThan(0);
      expect(
        screen.queryByPlaceholderText(/files\.annotationPlaceholder/i),
      ).toBeNull();
      expect(onCreateCodeAnnotation).not.toHaveBeenCalled();
      expect(writeWorkspaceFile).not.toHaveBeenCalled();
      expect(writeExternalSpecFile).not.toHaveBeenCalled();
    });

  it("keeps editor line clicks local before publishing the composer file range", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: ["one", "two", "three"].join("\n"),
        truncated: false,
      });
      const onActiveFileLineRangeChange = vi.fn();

      render(
        <FileViewPanel
          workspaceId="ws-md-line-click"
          workspacePath="/repo"
          filePath="docs/guide.md"
          activeFileLineRange={null}
          onActiveFileLineRangeChange={onActiveFileLineRangeChange}
          openTargets={[]}
          openAppIconById={{}}
          selectedOpenAppId=""
          onSelectOpenAppId={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await screen.findByTestId("file-markdown-preview");
      clickFileContextMenuItem(/files\.edit/i);
      const editor = (await screen.findByTestId(
        "mock-codemirror",
      )) as HTMLTextAreaElement;
      onActiveFileLineRangeChange.mockClear();

      vi.useFakeTimers();
      try {
        editor.setSelectionRange(4, 4);
        fireEvent.select(editor);

        expect(screen.queryByText("L2")).toBeNull();
        expect(onActiveFileLineRangeChange).not.toHaveBeenCalled();

        act(() => {
          vi.advanceTimersByTime(89);
        });
        expect(screen.queryByText("L2")).toBeNull();
        expect(onActiveFileLineRangeChange).not.toHaveBeenCalled();

        act(() => {
          vi.advanceTimersByTime(1);
        });
        expect(screen.getAllByText("L2").length).toBeGreaterThan(0);
        expect(onActiveFileLineRangeChange).toHaveBeenCalledWith({
          startLine: 2,
          endLine: 2,
        });
      } finally {
        vi.useRealTimers();
      }
    });

  it("drops pending editor line range publication after switching files", async () => {
      vi.mocked(readWorkspaceFile).mockImplementation(
        async (_workspaceId, path) => ({
          content:
            path === "docs/guide.md"
              ? ["one", "two", "three"].join("\n")
              : ["alpha", "beta"].join("\n"),
          truncated: false,
        }),
      );
      const onActiveFileLineRangeChange = vi.fn();
      const baseProps = {
        workspaceId: "ws-md-line-stale",
        workspacePath: "/repo",
        activeFileLineRange: null,
        onActiveFileLineRangeChange,
        openTargets: [],
        openAppIconById: {},
        selectedOpenAppId: "",
        onSelectOpenAppId: vi.fn(),
        onClose: vi.fn(),
        openTabs: ["docs/guide.md", "docs/other.md"],
        activeTabPath: "docs/guide.md",
        onActivateTab: vi.fn(),
        onCloseTab: vi.fn(),
        onCloseAllTabs: vi.fn(),
      };
      const { rerender } = render(
        <FileViewPanel {...baseProps} filePath="docs/guide.md" />,
      );

      await screen.findByTestId("file-markdown-preview");
      clickFileContextMenuItem(/files\.edit/i);
      const editor = (await screen.findByTestId(
        "mock-codemirror",
      )) as HTMLTextAreaElement;
      onActiveFileLineRangeChange.mockClear();

      vi.useFakeTimers();
      try {
        act(() => {
          editor.setSelectionRange(4, 4);
          fireEvent.select(editor);
        });

        act(() => {
          rerender(
            <FileViewPanel
              {...baseProps}
              filePath="docs/other.md"
              activeTabPath="docs/other.md"
            />,
          );
        });

        await act(async () => {
          vi.advanceTimersByTime(91);
          await Promise.resolve();
        });

        expect(onActiveFileLineRangeChange).toHaveBeenCalledWith(null);
        expect(onActiveFileLineRangeChange).not.toHaveBeenCalledWith({
          startLine: 2,
          endLine: 2,
        });
      } finally {
        vi.useRealTimers();
      }
    });

  it("does not run code intelligence requests for cursor movement alone", async () => {
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: ["function alpha() {", "  return 1;", "}"].join("\n"),
        truncated: false,
      });

      render(
        <FileViewPanel
          workspaceId="ws-code-intel-cursor"
          workspacePath="/repo"
          filePath="src/value.ts"
          activeFileLineRange={null}
          onActiveFileLineRangeChange={vi.fn()}
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
      fireEvent.select(editor, {
        target: {
          selectionStart: editor.value.indexOf("return"),
          selectionEnd: editor.value.indexOf("return"),
        },
      });

      expect(getCodeIntelDefinition).not.toHaveBeenCalled();
      expect(getCodeIntelImplementations).not.toHaveBeenCalled();
      expect(getCodeIntelReferences).not.toHaveBeenCalled();
    });
});
