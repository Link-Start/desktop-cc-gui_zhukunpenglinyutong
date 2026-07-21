/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, createRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { FileCodeMirrorEditorHandle } from "./FileCodeMirrorEditor";
import {
  FileCodeMirrorEditorImpl,
  fileGitBlameGutterExtension,
  isFileGitBlameContextMenuTarget,
  resolveFileCompareLineGapHeight,
  setGitBlameGutterEffect,
} from "./FileCodeMirrorEditorImpl";
import {
  focusEditorViewAtLocation,
  parseFileEditorLocation,
} from "../utils/fileEditorLocation";

let editorView: EditorView | null = null;

if (!Range.prototype.getClientRects) {
  Object.defineProperty(Range.prototype, "getClientRects", {
    value: () => [],
    configurable: true,
  });
}

afterEach(() => {
  cleanup();
  editorView?.destroy();
  editorView = null;
  document.body.replaceChildren();
});

const gotoLineLabels = {
  title: "Go to Line and Column",
  inputLabel: "Line:Column",
  placeholder: "For example, 2744:56",
  cancel: "Cancel",
  confirm: "Go",
  invalid: "Enter a valid line number or line:column.",
};

function renderGotoLineEditor() {
  const editorRef = createRef<FileCodeMirrorEditorHandle>();
  const { container } = render(
    createElement(FileCodeMirrorEditorImpl, {
      ref: editorRef,
      filePath: "src/example.ts",
      value: "first\nsecond\nthird",
      onChange: vi.fn(),
      theme: "light",
      languageExtensions: [],
      gitLineMarkers: { added: [], modified: [] },
      codeAnnotations: [],
      annotationDraft: null,
      annotationWidgetLabels: {
        title: "Annotation",
        remove: "Remove",
        placeholder: "Note",
        cancel: "Cancel",
        submit: "Submit",
      },
      annotationWidgetCallbacks: {
        onDraftCancel: vi.fn(),
        onDraftConfirm: vi.fn(),
      },
      runDefinitionFromCursor: vi.fn(),
      runReferencesFromCursor: vi.fn(),
      resolveDefinitionAtOffset: vi.fn(),
      lastReportedLineRangeRef: { current: "" },
      saveFileShortcut: null,
      handleSave: vi.fn(),
      gotoLineLabels,
    }),
  );
  const editorContent = container.querySelector<HTMLElement>(".cm-content");
  expect(editorRef.current?.view).toBeDefined();
  expect(editorContent).not.toBeNull();
  return { editorRef, editorContent: editorContent! };
}

function openGotoLineDialog(editorContent: HTMLElement) {
  fireEvent.keyDown(editorContent, { key: "g", code: "KeyG", metaKey: true });
  if (!screen.queryByRole("dialog")) {
    fireEvent.keyDown(editorContent, { key: "g", code: "KeyG", ctrlKey: true });
  }
  return screen.getByRole("textbox", {
    name: gotoLineLabels.inputLabel,
  }) as HTMLInputElement;
}

describe("file editor line navigation", () => {
  it("parses 1-based line and optional column values", () => {
    expect(parseFileEditorLocation("2744")).toEqual({ line: 2744, column: 1 });
    expect(parseFileEditorLocation(" 2744:56 ")).toEqual({ line: 2744, column: 56 });
    expect(parseFileEditorLocation("0:1")).toBeNull();
    expect(parseFileEditorLocation("1:0")).toBeNull();
    expect(parseFileEditorLocation("line 1")).toBeNull();
    expect(parseFileEditorLocation("999999999999999999999999")).toBeNull();
  });

  it("opens a modal with Mod+G and navigates from line:column input", () => {
    const { editorRef, editorContent } = renderGotoLineEditor();
    editorRef.current?.view?.focus();
    const input = openGotoLineDialog(editorContent);
    const dialog = screen.getByRole("dialog", { name: gotoLineLabels.title });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.querySelector(".fvp-goto-line-title-icon")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
    expect(input.value).toBe("1:1");

    fireEvent.change(input, { target: { value: "2:3" } });
    fireEvent.click(screen.getByRole("button", { name: gotoLineLabels.confirm }));

    expect(screen.queryByRole("dialog")).toBeNull();
    const view = editorRef.current?.view;
    expect(view).toBeDefined();
    if (!view) {
      throw new Error("Expected the editor view to be available after navigation.");
    }
    expect(view.state.selection.main.head).toBe(view.state.doc.line(2).from + 2);
  });

  it("keeps invalid input open and cancels without moving the cursor", () => {
    const { editorRef, editorContent } = renderGotoLineEditor();
    const input = openGotoLineDialog(editorContent);

    fireEvent.change(input, { target: { value: "0:1" } });
    fireEvent.click(screen.getByRole("button", { name: gotoLineLabels.confirm }));

    expect(screen.getByRole("alert").textContent).toBe(gotoLineLabels.invalid);
    expect(editorRef.current?.view?.state.selection.main.head).toBe(0);

    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(editorRef.current?.view?.state.selection.main.head).toBe(0);
  });

  it("clamps out-of-range line and column values", () => {
    const { editorRef, editorContent } = renderGotoLineEditor();
    const input = openGotoLineDialog(editorContent);

    fireEvent.change(input, { target: { value: "99:99" } });
    fireEvent.click(screen.getByRole("button", { name: gotoLineLabels.confirm }));

    const view = editorRef.current?.view;
    expect(view?.state.selection.main.head).toBe(view?.state.doc.length);
  });
});

describe("resolveFileCompareLineGapHeight", () => {
  it("uses CodeMirror's measured fractional line height without rounding", () => {
    expect(resolveFileCompareLineGapHeight(19, 18.203125)).toBe(345.859375);
  });

  it("does not produce negative widget geometry", () => {
    expect(resolveFileCompareLineGapHeight(-1, 18)).toBe(0);
    expect(resolveFileCompareLineGapHeight(4, -1)).toBe(0);
  });
});

describe("focusEditorViewAtLocation", () => {
  it("centers and focuses a valid endpoint source location", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    editorView = new EditorView({
      parent,
      state: EditorState.create({ doc: "first\nsecond\nthird" }),
    });
    const scrollIntoView = vi.spyOn(EditorView, "scrollIntoView");

    expect(focusEditorViewAtLocation(editorView, 2, 1, "center")).toBe(true);

    expect(editorView.state.selection.main.head).toBe(
      editorView.state.doc.line(2).from,
    );
    expect(scrollIntoView).toHaveBeenCalledWith(
      editorView.state.doc.line(2).from,
      { y: "center" },
    );
    expect(editorView.hasFocus).toBe(true);
  });

  it("rejects an out-of-range source line", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    editorView = new EditorView({
      parent,
      state: EditorState.create({ doc: "only" }),
    });

    expect(focusEditorViewAtLocation(editorView, 105, 1, "center")).toBe(false);
  });

  it("restores a captured line range after the editor document is available", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    editorView = new EditorView({
      parent,
      state: EditorState.create({ doc: "first\nsecond\nthird\nfourth" }),
    });

    expect(focusEditorViewAtLocation(editorView, 2, 1, "center", 3)).toBe(true);

    expect(editorView.state.selection.main.from).toBe(
      editorView.state.doc.line(2).from,
    );
    expect(editorView.state.selection.main.to).toBe(
      editorView.state.doc.line(3).to,
    );
  });

  it("clamps a stale captured end line to the current document", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    editorView = new EditorView({
      parent,
      state: EditorState.create({ doc: "first\nsecond\nthird" }),
    });

    expect(focusEditorViewAtLocation(editorView, 2, 1, "center", 37)).toBe(true);
    expect(editorView.state.selection.main.to).toBe(editorView.state.doc.length);
  });
});

describe("file Git Blame gutter", () => {
  const response = {
    path: "src/main.ts",
    headSha: "head",
    lineCount: 2,
    hunks: [
      {
        startLine: 1,
        lineCount: 2,
        commitSha: "0123456789abcdef",
        author: "Ada",
        authoredAt: 1_700_000_000,
        summary: "Explain the change",
        originalPath: null,
      },
    ],
  };

  it("renders hunk markers through a local StateEffect without recreating the editor", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    editorView = new EditorView({
      parent,
      state: EditorState.create({
        doc: "first\nsecond",
        extensions: [fileGitBlameGutterExtension()],
      }),
    });
    const initialView = editorView;

    editorView.dispatch({
      effects: setGitBlameGutterEffect.of({ status: "ready", response }),
    });

    expect(editorView).toBe(initialView);
    const markers = parent.querySelectorAll(".cm-file-git-blame-marker");
    expect(markers.length).toBeGreaterThan(0);
    expect(markers[0]?.textContent).toContain("Ada");
    expect(markers[0]?.textContent).not.toContain("Explain the change");
    expect(markers[0]?.getAttribute("aria-label")).toContain("01234567");
    const details = parent.querySelector(".cm-file-git-blame-inline-details");
    expect(details?.textContent).toContain("Explain the change");
    expect(details?.getAttribute("title")).toContain("01234567");
    expect(details?.getAttribute("aria-label")).toContain("01234567");
    expect(details?.closest(".cm-line")).not.toBeNull();
    expect(details?.closest(".cm-gutters")).toBeNull();
  });

  it("moves the inline details widget with the current line", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    editorView = new EditorView({
      parent,
      state: EditorState.create({
        doc: "first\nsecond",
        extensions: [fileGitBlameGutterExtension()],
      }),
    });
    editorView.dispatch({
      effects: setGitBlameGutterEffect.of({ status: "ready", response }),
    });

    const initialDetails = parent.querySelector(".cm-file-git-blame-inline-details");
    expect(initialDetails?.closest(".cm-line")?.textContent).toContain("first");

    editorView.dispatch({ selection: { anchor: editorView.state.doc.line(2).from } });

    const movedDetails = parent.querySelector(".cm-file-git-blame-inline-details");
    expect(movedDetails?.closest(".cm-line")?.textContent).toContain("second");
    expect(parent.querySelectorAll(".cm-file-git-blame-inline-details")).toHaveLength(1);
  });

  it("marks existing annotations stale through a bounded payload update", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    editorView = new EditorView({
      parent,
      state: EditorState.create({
        doc: "first",
        extensions: [fileGitBlameGutterExtension()],
      }),
    });

    editorView.dispatch({
      effects: setGitBlameGutterEffect.of({ status: "ready", response }),
    });
    editorView.dispatch({
      effects: setGitBlameGutterEffect.of({ status: "stale", response }),
    });

    expect(parent.querySelector(".cm-file-git-blame-marker")?.classList.contains("is-stale"))
      .toBe(true);
    expect(
      parent.querySelector(".cm-file-git-blame-inline-details")?.classList.contains("is-stale"),
    ).toBe(true);
  });

  it("keeps the custom context menu on gutters and leaves editor content native", () => {
    const gutters = document.createElement("div");
    gutters.className = "cm-gutters";
    const gutterChild = document.createElement("span");
    gutters.append(gutterChild);
    const content = document.createElement("div");
    content.className = "cm-content";

    expect(isFileGitBlameContextMenuTarget(gutterChild)).toBe(true);
    expect(isFileGitBlameContextMenuTarget(content)).toBe(false);
  });
});
