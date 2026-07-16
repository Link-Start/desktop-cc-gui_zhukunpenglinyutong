/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  fileGitBlameGutterExtension,
  isFileGitBlameContextMenuTarget,
  resolveFileCompareLineGapHeight,
  setGitBlameGutterEffect,
} from "./FileCodeMirrorEditorImpl";

let editorView: EditorView | null = null;

afterEach(() => {
  editorView?.destroy();
  editorView = null;
  document.body.replaceChildren();
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
