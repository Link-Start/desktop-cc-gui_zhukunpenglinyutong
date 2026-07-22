/** @vitest-environment jsdom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "./FileViewPanel.test-utils";
import { readWorkspaceFile } from "../../../services/tauri";
import { FileViewPanel } from "./FileViewPanel";
import { clearFileDocumentSessionCacheForTests } from "../hooks/useFileDocumentState";

function renderFileView(
  onCaptureNote: ReturnType<typeof vi.fn>,
  initialMode?: "edit" | "preview",
) {
  return render(
    <FileViewPanel
      workspaceId="workspace-note-capture"
      workspacePath="/repo"
      filePath="src/value.ts"
      initialMode={initialMode}
      openTargets={[]}
      openAppIconById={{}}
      selectedOpenAppId=""
      onSelectOpenAppId={vi.fn()}
      onClose={vi.fn()}
      onCaptureNote={onCaptureNote}
    />,
  );
}

describe("FileViewPanel note capture", () => {
  afterEach(() => {
    cleanup();
    clearFileDocumentSessionCacheForTests();
    vi.clearAllMocks();
  });

  it("captures the canonical CodeMirror selection with its exact line range", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "const first = 1;\nconst second = 2;\nconst third = 3;",
      truncated: false,
    });
    const onCaptureNote = vi.fn();
    const { container } = renderFileView(onCaptureNote);
    const editor = (await screen.findByTestId(
      "mock-codemirror",
    )) as HTMLTextAreaElement;
    const endAtThirdLine = editor.value.indexOf("const third");
    editor.setSelectionRange(0, endAtThirdLine);
    fireEvent.select(editor);

    fireEvent.contextMenu(
      container.querySelector(".fvp-editor-capture-surface") as HTMLElement,
      { clientX: 90, clientY: 70 },
    );
    expect(screen.getAllByRole("menu")).toHaveLength(1);
    fireEvent.click(
      screen.getByRole("menuitem", { name: "noteCards.captureSelection" }),
    );

    expect(onCaptureNote).toHaveBeenCalledTimes(1);
    expect(onCaptureNote.mock.calls[0]?.[0]).toMatchObject({
      source: {
        kind: "codeSelection",
        path: "src/value.ts",
        startLine: 1,
        endLine: 2,
      },
    });
    expect(onCaptureNote.mock.calls[0]?.[0].bodyMarkdown).toContain(
      "const first = 1;\nconst second = 2;",
    );
    expect(onCaptureNote.mock.calls[0]?.[0].bodyMarkdown).not.toContain(
      "const third = 3;",
    );
  });

  it("captures the complete current editor document when no text is selected", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "const first = 1;\nconst second = 2;",
      truncated: false,
    });
    const onCaptureNote = vi.fn();
    renderFileView(onCaptureNote);
    const editor = (await screen.findByTestId(
      "mock-codemirror",
    )) as HTMLTextAreaElement;
    fireEvent.change(editor, {
      target: {
        value: "const first = 10;\nconst second = 20;\nconst unsaved = true;",
      },
    });

    fireEvent.contextMenu(editor, { clientX: 90, clientY: 70 });
    fireEvent.click(
      screen.getByRole("menuitem", { name: "noteCards.captureWholeFile" }),
    );

    expect(onCaptureNote).toHaveBeenCalledWith(
      expect.objectContaining({
        bodyMarkdown: expect.stringContaining(
          "const first = 10;\nconst second = 20;\nconst unsaved = true;",
        ),
        source: {
          kind: "codeSelection",
          path: "src/value.ts",
          startLine: 1,
          endLine: 3,
          language: "typescript",
        },
      }),
    );
  });

  it("captures the current editor selection with the IDEA-style note shortcut", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "const first = 1;\nconst second = 2;",
      truncated: false,
    });
    const onCaptureNote = vi.fn();
    renderFileView(onCaptureNote);
    const editor = (await screen.findByTestId(
      "mock-codemirror",
    )) as HTMLTextAreaElement;
    editor.setSelectionRange(0, "const first = 1;".length);
    fireEvent.select(editor);

    fireEvent.keyDown(editor, {
      key: "n",
      altKey: true,
      shiftKey: true,
    });

    expect(onCaptureNote).toHaveBeenCalledWith(
      expect.objectContaining({
        bodyMarkdown: expect.stringContaining("const first = 1;"),
        source: expect.objectContaining({ startLine: 1, endLine: 1 }),
      }),
    );
  });

  it("captures the frozen logical line selection from code preview", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "const first = 1;\nconst second = 2;\nconst third = 3;",
      truncated: false,
    });
    const onCaptureNote = vi.fn();
    const { container } = renderFileView(onCaptureNote, "preview");
    await waitFor(() => {
      expect(container.querySelector(".fvp-code-preview")).toBeTruthy();
    });
    const lines = container.querySelectorAll<HTMLElement>(".fvp-code-line");
    const firstLine = lines.item(0);
    const secondLine = lines.item(1);
    if (!firstLine || !secondLine) {
      throw new Error("Expected preview code lines");
    }
    fireEvent.click(firstLine);
    fireEvent.click(secondLine, { shiftKey: true });

    fireEvent.contextMenu(
      container.querySelector(
        ".fvp-code-preview-capture-surface",
      ) as HTMLElement,
      { clientX: 110, clientY: 90 },
    );
    fireEvent.click(
      screen.getByRole("menuitem", { name: "noteCards.captureSelection" }),
    );

    expect(onCaptureNote).toHaveBeenCalledWith(
      expect.objectContaining({
        bodyMarkdown: expect.stringContaining(
          "const first = 1;\nconst second = 2;",
        ),
        source: {
          kind: "codeSelection",
          path: "src/value.ts",
          startLine: 1,
          endLine: 2,
          language: "typescript",
        },
      }),
    );
  });

  it("captures the complete source from code preview when no logical lines are selected", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "const first = 1;\nconst second = 2;\nconst third = 3;",
      truncated: false,
    });
    const onCaptureNote = vi.fn();
    const { container } = renderFileView(onCaptureNote, "preview");
    await waitFor(() => {
      expect(container.querySelector(".fvp-code-preview")).toBeTruthy();
    });

    fireEvent.contextMenu(
      container.querySelector(
        ".fvp-code-preview-capture-surface",
      ) as HTMLElement,
      { clientX: 110, clientY: 90 },
    );
    fireEvent.click(
      screen.getByRole("menuitem", { name: "noteCards.captureWholeFile" }),
    );

    expect(onCaptureNote).toHaveBeenCalledWith(
      expect.objectContaining({
        bodyMarkdown: expect.stringContaining(
          "const first = 1;\nconst second = 2;\nconst third = 3;",
        ),
        source: expect.objectContaining({ startLine: 1, endLine: 3 }),
      }),
    );
  });

  it.each([
    { name: "blank", content: "   \n", truncated: false },
    { name: "truncated", content: "partial file", truncated: true },
  ])("does not label $name content as a complete-file capture", async ({ content, truncated }) => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({ content, truncated });
    const onCaptureNote = vi.fn();
    const { container } = renderFileView(onCaptureNote);
    await waitFor(() => {
      expect(screen.queryByText("files.loadingFile")).toBeNull();
    });

    fireEvent.contextMenu(container.querySelector(".fvp-body") as HTMLElement);

    expect(
      screen.queryByRole("menuitem", { name: "noteCards.captureWholeFile" }),
    ).toBeNull();
    expect(onCaptureNote).not.toHaveBeenCalled();
  });
});
