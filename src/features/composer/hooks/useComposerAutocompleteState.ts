import { useCallback, useMemo } from "react";

type UseComposerAutocompleteStateArgs = {
  text: string;
  selectionStart: number | null;
  setText: (next: string) => void;
  setSelectionStart: (next: number | null) => void;
};

// 与 ChatInputBox completion dropdown 的 trigger 集合对齐：长 trigger 优先匹配，
// 保证 "@@"/"@#" 先于 "@" 命中。
const COMPLETION_TRIGGERS = ["@#", "@@", "/", "$", "@"] as const;

const whitespaceRegex = /\s/;
const triggerPrefixRegex = /^(?:\s|["'`]|\(|\[|\{)$/;

// 纯文本扫描：光标前最近一次非空白片段是否以某个补全 trigger 开头。
// 不计算候选项——候选的计算与渲染由 ChatInputBox completion providers 唯一承担。
function detectCompletionTriggerContext(
  text: string,
  cursor: number | null,
): boolean {
  if (!text || cursor === null || cursor <= 0) {
    return false;
  }
  let index = cursor - 1;
  while (index >= 0) {
    const char = text[index] ?? "";
    if (whitespaceRegex.test(char)) {
      break;
    }
    for (const trigger of COMPLETION_TRIGGERS) {
      const start = index - trigger.length + 1;
      if (start < 0) {
        continue;
      }
      if (text.slice(start, index + 1) !== trigger) {
        continue;
      }
      const prevChar = start > 0 ? (text[start - 1] ?? "") : "";
      if (prevChar && !triggerPrefixRegex.test(prevChar)) {
        continue;
      }
      const query = text.slice(start + trigger.length, cursor);
      if (whitespaceRegex.test(query)) {
        continue;
      }
      return true;
    }
    index -= 1;
  }
  return false;
}

export function useComposerAutocompleteState({
  text,
  selectionStart,
  setText,
  setSelectionStart,
}: UseComposerAutocompleteStateArgs) {
  // 该布尔仅用于抑制 inline history completion 与 ↑/↓ 历史导航：
  // 用户处于补全输入语境时，即使当前无候选也不应触发历史行为。
  const isAutocompleteOpen = useMemo(
    () => detectCompletionTriggerContext(text, selectionStart),
    [selectionStart, text],
  );

  const handleTextChange = useCallback(
    (next: string, cursor: number | null) => {
      setText(next);
      setSelectionStart(cursor);
    },
    [setSelectionStart, setText],
  );

  const handleSelectionChange = useCallback(
    (cursor: number | null) => {
      setSelectionStart(cursor);
    },
    [setSelectionStart],
  );

  return {
    isAutocompleteOpen,
    handleTextChange,
    handleSelectionChange,
  };
}
