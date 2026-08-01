import type { EditorView } from "@codemirror/view";
import { EditorView as CodeMirrorEditorView } from "@codemirror/view";

export type FileEditorLocation = {
  line: number;
  column: number;
};

export function parseFileEditorLocation(value: string): FileEditorLocation | null {
  const match = /^\s*(\d+)(?::(\d+))?\s*$/.exec(value);
  if (!match) {
    return null;
  }
  const line = Number(match[1]);
  const column = match[2] === undefined ? 1 : Number(match[2]);
  if (
    !Number.isSafeInteger(line) ||
    !Number.isSafeInteger(column) ||
    line < 1 ||
    column < 1
  ) {
    return null;
  }
  return { line, column };
}

export function focusEditorViewAtLocation(
  view: EditorView,
  line: number,
  column: number,
  scrollPosition: "nearest" | "center" = "nearest",
  endLine?: number,
): boolean {
  if (line < 1 || line > view.state.doc.lines) {
    return false;
  }
  if (endLine !== undefined && (!Number.isInteger(endLine) || endLine < line)) {
    return false;
  }
  const lineInfo = view.state.doc.line(line);
  const safeColumn = Math.max(1, Math.min(column, lineInfo.length + 1));
  const anchor = lineInfo.from + safeColumn - 1;
  const head =
    endLine === undefined
      ? anchor
      : view.state.doc.line(Math.min(endLine, view.state.doc.lines)).to;
  view.dispatch({
    selection: { anchor, head },
    effects: CodeMirrorEditorView.scrollIntoView(anchor, {
      y: scrollPosition === "center" ? "center" : "nearest",
    }),
  });
  view.focus();
  return true;
}
