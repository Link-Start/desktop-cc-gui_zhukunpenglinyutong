import type { NoteCaptureDraft } from "../types";

export type CodeSelectionCapture = {
  path: string;
  content: string;
  startLine: number;
  endLine: number;
  language?: string | null;
};

function resolveFence(content: string): string {
  const longestBacktickRun = Math.max(
    0,
    ...Array.from(content.matchAll(/`+/g), (match) => match[0].length),
  );
  return "`".repeat(Math.max(3, longestBacktickRun + 1));
}

function resolveCodeSelectionTitle(path: string, startLine: number, endLine: number): string {
  const fileName = path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
  const lineRange = startLine === endLine ? `L${startLine}` : `L${startLine}–L${endLine}`;
  return `${fileName} · ${lineRange}`;
}

export function buildCodeSelectionNoteDraft(
  selection: CodeSelectionCapture,
): NoteCaptureDraft | null {
  const path = selection.path.trim();
  const content = selection.content;
  if (
    !path ||
    !content.trim() ||
    !Number.isInteger(selection.startLine) ||
    !Number.isInteger(selection.endLine) ||
    selection.startLine <= 0 ||
    selection.endLine < selection.startLine
  ) {
    return null;
  }
  const language = selection.language?.trim() || null;
  const fence = resolveFence(content);
  const closingFencePrefix = content.endsWith("\n") ? "" : "\n";

  return {
    title: resolveCodeSelectionTitle(path, selection.startLine, selection.endLine),
    bodyMarkdown:
      `${fence}${language ?? ""}\n${content}${closingFencePrefix}${fence}`,
    source: {
      kind: "codeSelection",
      path,
      startLine: selection.startLine,
      endLine: selection.endLine,
      language,
    },
  };
}
