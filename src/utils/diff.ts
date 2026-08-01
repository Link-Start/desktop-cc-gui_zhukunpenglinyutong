export interface DiffStats {
  additions: number;
  deletions: number;
}

export type DiffLineType = "unchanged" | "deleted" | "added";

export interface DiffLine {
  type: DiffLineType;
  content: string;
}

export interface DiffResult extends DiffStats {
  lines: DiffLine[];
}

export type ParsedDiffLine = {
  type: "add" | "del" | "context" | "hunk" | "meta";
  oldLine: number | null;
  newLine: number | null;
  text: string;
};

const HUNK_REGEX = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
const MAX_LCS_PRODUCT = 250_000;

function splitLines(value: string): string[] {
  if (!value) {
    return [];
  }
  return value.split("\n");
}

export function computeDiff(oldStr: string, newStr: string): DiffResult {
  const oldLines = splitLines(oldStr);
  const newLines = splitLines(newStr);
  const oldLength = oldLines.length;
  const newLength = newLines.length;

  if (oldLength === 0 && newLength === 0) {
    return { lines: [], additions: 0, deletions: 0 };
  }
  if (oldLength === 0) {
    return {
      lines: newLines.map((content) => ({ type: "added" as const, content })),
      additions: newLength,
      deletions: 0,
    };
  }
  if (newLength === 0) {
    return {
      lines: oldLines.map((content) => ({ type: "deleted" as const, content })),
      additions: 0,
      deletions: oldLength,
    };
  }

  if (oldLength * newLength > MAX_LCS_PRODUCT) {
    return {
      lines: [
        ...oldLines.map((content) => ({ type: "deleted" as const, content })),
        ...newLines.map((content) => ({ type: "added" as const, content })),
      ],
      additions: newLength,
      deletions: oldLength,
    };
  }

  const lcs: number[][] = Array.from({ length: oldLength + 1 }, () =>
    Array<number>(newLength + 1).fill(0),
  );

  for (let oi = 1; oi <= oldLength; oi++) {
    for (let ni = 1; ni <= newLength; ni++) {
      if (oldLines[oi - 1] === newLines[ni - 1]) {
        lcs[oi]![ni] = (lcs[oi - 1]?.[ni - 1] ?? 0) + 1;
      } else {
        lcs[oi]![ni] = Math.max(lcs[oi - 1]?.[ni] ?? 0, lcs[oi]?.[ni - 1] ?? 0);
      }
    }
  }

  let additions = 0;
  let deletions = 0;
  let oi = oldLength;
  let ni = newLength;
  const lines: DiffLine[] = [];

  while (oi > 0 || ni > 0) {
    if (oi > 0 && ni > 0 && oldLines[oi - 1] === newLines[ni - 1]) {
      lines.push({ type: "unchanged", content: oldLines[oi - 1] ?? "" });
      oi--;
      ni--;
      continue;
    }
    if (ni > 0 && (oi === 0 || (lcs[oi]?.[ni - 1] ?? 0) >= (lcs[oi - 1]?.[ni] ?? 0))) {
      additions++;
      lines.push({ type: "added", content: newLines[ni - 1] ?? "" });
      ni--;
    } else {
      deletions++;
      lines.push({ type: "deleted", content: oldLines[oi - 1] ?? "" });
      oi--;
    }
  }

  lines.reverse();

  return { lines, additions, deletions };
}

export function computeDiffStats(oldStr: string, newStr: string): DiffStats {
  const result = computeDiff(oldStr, newStr);
  return { additions: result.additions, deletions: result.deletions };
}

export function computeDiffFromUnifiedPatch(diffText: string): DiffStats {
  let additions = 0;
  let deletions = 0;
  const lines = diffText.split("\n");
  for (const line of lines) {
    if (line.startsWith("+") && !line.startsWith("+++")) {
      additions++;
      continue;
    }
    if (line.startsWith("-") && !line.startsWith("---")) {
      deletions++;
    }
  }
  return { additions, deletions };
}

export function parseDiff(diff: string): ParsedDiffLine[] {
  const lines = diff.split("\n");
  const parsed: ParsedDiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;
  let inHunk = false;

  for (const line of lines) {
    if (line.startsWith("@@")) {
      const match = HUNK_REGEX.exec(line);
      if (match) {
        oldLine = Number(match[1]);
        newLine = Number(match[3]);
      }
      parsed.push({
        type: "hunk",
        oldLine: null,
        newLine: null,
        text: line,
      });
      inHunk = true;
      continue;
    }

    if (!inHunk) {
      continue;
    }

    if (line.startsWith("+")) {
      parsed.push({
        type: "add",
        oldLine: null,
        newLine,
        text: line.slice(1),
      });
      newLine += 1;
      continue;
    }

    if (line.startsWith("-")) {
      parsed.push({
        type: "del",
        oldLine,
        newLine: null,
        text: line.slice(1),
      });
      oldLine += 1;
      continue;
    }

    if (line.startsWith(" ")) {
      parsed.push({
        type: "context",
        oldLine,
        newLine,
        text: line.slice(1),
      });
      oldLine += 1;
      newLine += 1;
      continue;
    }

    if (line.startsWith("\\")) {
      parsed.push({
        type: "meta",
        oldLine: null,
        newLine: null,
        text: line,
      });
    }
  }

  return parsed;
}
