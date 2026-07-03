import { useCallback, useRef } from "react";
import type { RefObject } from "react";

type UseComposerInsertArgs = {
  activeThreadId: string | null;
  // 命令式读取当前草稿(草稿活在 composerDraftStore 里,不再经根级 state 灌入)。
  // 读取发生在插入动作那一刻,天然拿到最新值,不需要 prop 同步。
  getDraftText: () => string;
  onDraftChange: (next: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
};

export function useComposerInsert({
  activeThreadId,
  getDraftText,
  onDraftChange,
  textareaRef,
}: UseComposerInsertArgs) {
  const latestSelectionRef = useRef<number | null>(null);

  return useCallback(
    (insertText: string) => {
      const textarea = textareaRef.current;
      const currentText = getDraftText() ?? "";
      const isTextareaActive =
        textarea !== null &&
        typeof document !== "undefined" &&
        document.activeElement === textarea;
      const hasSelectionRange =
        textarea !== null &&
        typeof textarea.selectionStart === "number" &&
        typeof textarea.selectionEnd === "number";
      const canUseSelection = activeThreadId
        ? isTextareaActive && hasSelectionRange
        : hasSelectionRange;
      const selectionStart = canUseSelection && textarea
        ? textarea.selectionStart
        : null;
      const selectionEnd = canUseSelection && textarea
        ? textarea.selectionEnd
        : null;
      const start = canUseSelection
        ? (selectionStart ?? latestSelectionRef.current ?? currentText.length)
        : latestSelectionRef.current ?? currentText.length;
      const end = canUseSelection ? (selectionEnd ?? start) : start;
      const before = currentText.slice(0, start);
      const after = currentText.slice(end);
      const needsSpaceBefore = before.length > 0 && !/\s$/.test(before);
      const needsSpaceAfter = after.length > 0 && !/^\s/.test(after);
      const prefix = needsSpaceBefore ? " " : "";
      const suffix = needsSpaceAfter ? " " : "";
      const nextText = `${before}${prefix}${insertText}${suffix}${after}`;
      const cursor =
        before.length +
        prefix.length +
        insertText.length +
        (needsSpaceAfter ? 1 : 0);
      const safeCursor = Math.min(cursor, nextText.length);
      latestSelectionRef.current = safeCursor;
      onDraftChange(nextText);
      requestAnimationFrame(() => {
        const node = textareaRef.current;
        if (!node) {
          return;
        }
        node.focus();
        const nextCursor = Math.min(safeCursor, node.value.length);
        node.setSelectionRange(nextCursor, nextCursor);
        latestSelectionRef.current = nextCursor;
        node.dispatchEvent(new Event("select", { bubbles: true }));
      });
    },
    [activeThreadId, getDraftText, onDraftChange, textareaRef],
  );
}
