import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import ListOrdered from "lucide-react/dist/esm/icons/list-ordered";
import {
  focusEditorViewAtLocation,
  parseFileEditorLocation,
} from "../utils/fileEditorLocation";

export type FileEditorGotoLineLabels = {
  title: string;
  inputLabel: string;
  placeholder: string;
  cancel: string;
  confirm: string;
  invalid: string;
};

export type FileEditorGotoLineDialogHandle = {
  open: (view: EditorView) => boolean;
};

export const FileEditorGotoLineDialog = forwardRef<
  FileEditorGotoLineDialogHandle,
  { labels: FileEditorGotoLineLabels }
>(function FileEditorGotoLineDialog({ labels }, ref) {
  const editorViewRef = useRef<EditorView | null>(null);
  const [input, setInput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setInput(null);
    setError(null);
    requestAnimationFrame(() => editorViewRef.current?.focus());
  };

  useImperativeHandle(ref, () => ({
    open(view) {
      const head = view.state.selection.main.head;
      const currentLine = view.state.doc.lineAt(head);
      editorViewRef.current = view;
      setInput(`${currentLine.number}:${head - currentLine.from + 1}`);
      setError(null);
      return true;
    },
  }), []);

  if (input === null) {
    return null;
  }

  const submit = () => {
    const location = parseFileEditorLocation(input);
    const view = editorViewRef.current;
    if (!location || !view) {
      setError(labels.invalid);
      return;
    }
    const line = Math.min(location.line, view.state.doc.lines);
    setInput(null);
    setError(null);
    focusEditorViewAtLocation(view, line, location.column, "center");
  };

  return (
    <div
      className="fvp-goto-line-overlay"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <form
        className="fvp-goto-line-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fvp-goto-line-title"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          submit();
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") {
            event.preventDefault();
            close();
          }
        }}
      >
        <div className="fvp-goto-line-title">
          <span className="fvp-goto-line-title-icon" aria-hidden="true">
            <ListOrdered size={14} />
          </span>
          <h2 id="fvp-goto-line-title">{labels.title}</h2>
        </div>
        <label htmlFor="fvp-goto-line-input">{labels.inputLabel}</label>
        <input
          id="fvp-goto-line-input"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          value={input}
          placeholder={labels.placeholder}
          aria-invalid={error !== null}
          aria-describedby={error ? "fvp-goto-line-error" : undefined}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => {
            setInput(event.currentTarget.value);
            setError(null);
          }}
        />
        {error ? (
          <p id="fvp-goto-line-error" className="fvp-goto-line-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="fvp-goto-line-actions">
          <button type="button" onClick={close}>{labels.cancel}</button>
          <button type="submit" className="is-primary">{labels.confirm}</button>
        </div>
      </form>
    </div>
  );
});
