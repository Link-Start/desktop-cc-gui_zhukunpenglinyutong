import type {
  CodeAnnotationAnchor,
  CodeAnnotationDraftInput,
  CodeAnnotationLineRange,
  CodeAnnotationSelection,
} from "../types";

const ANCHOR_CONTEXT_LINE_COUNT = 2;
export const CODE_ANNOTATION_RELOCATION_WINDOW_LINES = 120;

function stableAnnotationHash(value: string) {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function splitLogicalLines(content: string) {
  return content.replace(/\r\n?/g, "\n").split("\n");
}

function buildAnchorFingerprint(
  selectedText: string,
  prefixText: string,
  suffixText: string,
) {
  return stableAnnotationHash([prefixText, selectedText, suffixText].join("\u0000"));
}

export function createCodeAnnotationAnchorFromSnapshot(
  selectedText: string,
  prefixText = "",
  suffixText = "",
): CodeAnnotationAnchor | undefined {
  const normalizedSelectedText = selectedText.replace(/\r\n?/g, "\n");
  if (!normalizedSelectedText) {
    return undefined;
  }
  const normalizedPrefixText = prefixText.replace(/\r\n?/g, "\n");
  const normalizedSuffixText = suffixText.replace(/\r\n?/g, "\n");
  return {
    version: 1,
    selectedText: normalizedSelectedText,
    prefixText: normalizedPrefixText,
    suffixText: normalizedSuffixText,
    fingerprint: buildAnchorFingerprint(
      normalizedSelectedText,
      normalizedPrefixText,
      normalizedSuffixText,
    ),
  };
}

export function createCodeAnnotationAnchor(
  content: string,
  lineRange: CodeAnnotationLineRange,
): CodeAnnotationAnchor | undefined {
  const normalizedLineRange = normalizeLineRange(lineRange);
  if (!normalizedLineRange) {
    return undefined;
  }
  const lines = splitLogicalLines(content);
  const startIndex = normalizedLineRange.startLine - 1;
  const endIndex = normalizedLineRange.endLine;
  if (startIndex >= lines.length) {
    return undefined;
  }
  return createCodeAnnotationAnchorFromSnapshot(
    lines.slice(startIndex, endIndex).join("\n"),
    lines
      .slice(Math.max(0, startIndex - ANCHOR_CONTEXT_LINE_COUNT), startIndex)
      .join("\n"),
    lines
      .slice(endIndex, endIndex + ANCHOR_CONTEXT_LINE_COUNT)
      .join("\n"),
  );
}

export function attachCodeAnnotationAnchor(
  input: CodeAnnotationDraftInput,
  content: string,
): CodeAnnotationDraftInput {
  return {
    ...input,
    anchor: createCodeAnnotationAnchor(content, input.lineRange),
  };
}

function normalizeAnnotationPath(path: string) {
  return path.trim().replace(/\\/g, "/").replace(/^\/+/, "");
}

function toCodeAnnotationPathKey(path: string) {
  const normalizedPath = normalizeAnnotationPath(path);
  return /^[A-Za-z]:\//.test(normalizedPath)
    ? normalizedPath.toLowerCase()
    : normalizedPath;
}

function normalizeLineRange(
  lineRange: CodeAnnotationLineRange,
): CodeAnnotationLineRange | null {
  const startLine = Math.trunc(lineRange.startLine);
  const endLine = Math.trunc(lineRange.endLine);
  if (
    !Number.isFinite(startLine) ||
    !Number.isFinite(endLine) ||
    startLine < 1 ||
    endLine < 1
  ) {
    return null;
  }
  return {
    startLine: Math.min(startLine, endLine),
    endLine: Math.max(startLine, endLine),
  };
}

export function normalizeCodeAnnotationTarget(
  input: CodeAnnotationDraftInput,
): CodeAnnotationDraftInput | null {
  const path = normalizeAnnotationPath(input.path);
  const body = input.body.trim();
  const lineRange = normalizeLineRange(input.lineRange);
  if (!path || !body || !lineRange) {
    return null;
  }
  return {
    path,
    lineRange,
    body,
    source: input.source,
    ...(input.anchor ? { anchor: input.anchor } : {}),
  };
}

export function formatCodeAnnotationLineRange(lineRange: CodeAnnotationLineRange) {
  if (lineRange.startLine === lineRange.endLine) {
    return `L${lineRange.startLine}`;
  }
  return `L${lineRange.startLine}-L${lineRange.endLine}`;
}

export function formatCodeAnnotationReference(
  selection: Pick<CodeAnnotationSelection, "path" | "lineRange">,
) {
  return `${selection.path}#${formatCodeAnnotationLineRange(selection.lineRange)}`;
}

export function buildCodeAnnotationDedupeKey(selection: CodeAnnotationDraftInput) {
  const normalized = normalizeCodeAnnotationTarget(selection);
  if (!normalized) {
    return "";
  }
  return [
    toCodeAnnotationPathKey(normalized.path),
    normalized.lineRange.startLine,
    normalized.lineRange.endLine,
    normalized.body,
  ].join("::");
}

export function isSameCodeAnnotationPath(leftPath: string, rightPath: string) {
  const leftKey = toCodeAnnotationPathKey(leftPath);
  const rightKey = toCodeAnnotationPathKey(rightPath);
  return Boolean(leftKey) && leftKey === rightKey;
}

export function formatCodeAnnotationForPrompt(selection: CodeAnnotationSelection) {
  const lines = [
    `@file \`${formatCodeAnnotationReference(selection)}\``,
    `标注：${selection.body}`,
  ];
  if (selection.anchor?.selectedText) {
    lines.push(`选中代码：\n${selection.anchor.selectedText}`);
  }
  return lines.join("\n");
}

export function createCodeAnnotationSelection(
  input: CodeAnnotationDraftInput,
): CodeAnnotationSelection | null {
  const normalized = normalizeCodeAnnotationTarget(input);
  if (!normalized) {
    return null;
  }
  const dedupeKey = buildCodeAnnotationDedupeKey(normalized);
  return {
    id: `code-annotation:${stableAnnotationHash(dedupeKey)}`,
    ...normalized,
  };
}

export type CodeAnnotationAnchorResolution = {
  lineRange: CodeAnnotationLineRange;
  status: "exact" | "relocated" | "stale" | "unanchored";
};

function candidateMatchesContext(
  lines: string[],
  startIndex: number,
  selectedLineCount: number,
  anchor: CodeAnnotationAnchor,
) {
  const prefixText = lines
    .slice(
      Math.max(0, startIndex - ANCHOR_CONTEXT_LINE_COUNT),
      startIndex,
    )
    .join("\n");
  const suffixStartIndex = startIndex + selectedLineCount;
  const suffixText = lines
    .slice(suffixStartIndex, suffixStartIndex + ANCHOR_CONTEXT_LINE_COUNT)
    .join("\n");
  return (
    buildAnchorFingerprint(anchor.selectedText, prefixText, suffixText) ===
    anchor.fingerprint
  );
}

export function resolveCodeAnnotationAnchor(
  content: string,
  selection: Pick<CodeAnnotationSelection, "lineRange" | "anchor">,
): CodeAnnotationAnchorResolution {
  const originalLineRange = normalizeLineRange(selection.lineRange);
  if (!originalLineRange) {
    return { lineRange: selection.lineRange, status: "stale" };
  }
  const anchor = selection.anchor;
  if (!anchor) {
    return { lineRange: originalLineRange, status: "unanchored" };
  }
  if (
    anchor.version !== 1 ||
    !anchor.selectedText ||
    buildAnchorFingerprint(
      anchor.selectedText,
      anchor.prefixText,
      anchor.suffixText,
    ) !== anchor.fingerprint
  ) {
    return { lineRange: originalLineRange, status: "stale" };
  }

  const lines = splitLogicalLines(content);
  const selectedLines = splitLogicalLines(anchor.selectedText);
  const selectedLineCount = selectedLines.length;
  const originalStartIndex = originalLineRange.startLine - 1;
  const matchesAt = (startIndex: number) =>
    startIndex >= 0 &&
    startIndex + selectedLineCount <= lines.length &&
    selectedLines.every((line, index) => lines[startIndex + index] === line);
  if (matchesAt(originalStartIndex)) {
    return { lineRange: originalLineRange, status: "exact" };
  }

  const firstCandidateIndex = Math.max(
    0,
    originalStartIndex - CODE_ANNOTATION_RELOCATION_WINDOW_LINES,
  );
  const lastCandidateIndex = Math.min(
    lines.length - selectedLineCount,
    originalStartIndex + CODE_ANNOTATION_RELOCATION_WINDOW_LINES,
  );
  const candidates: number[] = [];
  for (
    let candidateIndex = firstCandidateIndex;
    candidateIndex <= lastCandidateIndex;
    candidateIndex += 1
  ) {
    if (matchesAt(candidateIndex)) {
      candidates.push(candidateIndex);
    }
  }
  const contextCandidates =
    candidates.length > 1
      ? candidates.filter((candidateIndex) =>
          candidateMatchesContext(
            lines,
            candidateIndex,
            selectedLineCount,
            anchor,
          ),
        )
      : [];
  const resolvedCandidate =
    candidates.length === 1
      ? candidates[0]
      : contextCandidates.length === 1
        ? contextCandidates[0]
        : undefined;
  if (resolvedCandidate === undefined) {
    return { lineRange: originalLineRange, status: "stale" };
  }
  return {
    lineRange: {
      startLine: resolvedCandidate + 1,
      endLine: resolvedCandidate + selectedLineCount,
    },
    status: "relocated",
  };
}

export function resolveCodeAnnotationsForFile(
  content: string,
  filePath: string,
  annotations: CodeAnnotationSelection[],
) {
  return annotations
    .filter((annotation) => isSameCodeAnnotationPath(annotation.path, filePath))
    .map((annotation) => ({
      ...annotation,
      lineRange: resolveCodeAnnotationAnchor(content, annotation).lineRange,
    }));
}

export function appendCodeAnnotationsToPrompt(
  message: string,
  annotations: CodeAnnotationSelection[],
) {
  if (annotations.length === 0) {
    return message;
  }
  const annotationBlock = annotations.map(formatCodeAnnotationForPrompt).join("\n\n");
  return [message.trim(), annotationBlock].filter(Boolean).join("\n\n");
}
