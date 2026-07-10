type SourceLines = {
  lines: string[];
  lineEnding: "\n" | "\r\n" | "\r";
  endsWithLineEnding: boolean;
};

const HUNK_HEADER_PATTERN = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

function splitSourceLines(source: string): SourceLines {
  const lineEnding = source.includes("\r\n")
    ? "\r\n"
    : source.includes("\r")
      ? "\r"
      : "\n";
  const endsWithLineEnding = source.endsWith("\n") || source.endsWith("\r");
  const lines = source.length === 0 ? [] : source.split(/\r\n|\n|\r/);
  if (endsWithLineEnding) {
    lines.pop();
  }
  return { lines, lineEnding, endsWithLineEnding };
}

function joinSourceLines(source: SourceLines) {
  const content = source.lines.join(source.lineEnding);
  return source.endsWithLineEnding && source.lines.length > 0
    ? `${content}${source.lineEnding}`
    : content;
}

export function reconstructPreviousVersion(
  workingSource: string,
  unifiedPatch: string,
): string | null {
  const patchLines = unifiedPatch.replace(/\r\n/g, "\n").split("\n");
  const working = splitSourceLines(workingSource);
  const previousLines: string[] = [];
  let workingIndex = 0;
  let patchIndex = 0;
  let foundHunk = false;
  let previousEndsWithLineEnding = working.endsWithLineEnding;

  while (patchIndex < patchLines.length) {
    const headerMatch = HUNK_HEADER_PATTERN.exec(patchLines[patchIndex] ?? "");
    if (!headerMatch) {
      patchIndex += 1;
      continue;
    }

    foundHunk = true;
    const expectedOldCount = Number.parseInt(headerMatch[2] ?? "1", 10);
    const newStart = Number.parseInt(headerMatch[3] ?? "0", 10);
    const expectedNewCount = Number.parseInt(headerMatch[4] ?? "1", 10);
    const hunkWorkingIndex = newStart === 0 ? 0 : newStart - 1;
    if (hunkWorkingIndex < workingIndex || hunkWorkingIndex > working.lines.length) {
      return null;
    }
    previousLines.push(...working.lines.slice(workingIndex, hunkWorkingIndex));
    workingIndex = hunkWorkingIndex;
    patchIndex += 1;

    let oldCount = 0;
    let newCount = 0;
    let previousPrefix: " " | "+" | "-" | null = null;
    while (patchIndex < patchLines.length) {
      const patchLine = patchLines[patchIndex] ?? "";
      if (HUNK_HEADER_PATTERN.test(patchLine) || patchLine.startsWith("diff --git ")) {
        break;
      }
      const prefix = patchLine[0];
      const lineContent = patchLine.slice(1);
      if (prefix === " ") {
        if (working.lines[workingIndex] !== lineContent) {
          return null;
        }
        previousLines.push(lineContent);
        workingIndex += 1;
        oldCount += 1;
        newCount += 1;
        previousPrefix = " ";
      } else if (prefix === "+") {
        if (working.lines[workingIndex] !== lineContent) {
          return null;
        }
        workingIndex += 1;
        newCount += 1;
        previousPrefix = "+";
      } else if (prefix === "-") {
        previousLines.push(lineContent);
        oldCount += 1;
        previousPrefix = "-";
      } else if (patchLine === "\\ No newline at end of file") {
        if (previousPrefix === "-" || previousPrefix === " ") {
          previousEndsWithLineEnding = false;
        }
      } else if (patchLine.length > 0) {
        return null;
      }
      patchIndex += 1;
    }

    if (oldCount !== expectedOldCount || newCount !== expectedNewCount) {
      return null;
    }
  }

  if (!foundHunk) {
    return null;
  }
  previousLines.push(...working.lines.slice(workingIndex));
  return joinSourceLines({
    lines: previousLines,
    lineEnding: working.lineEnding,
    endsWithLineEnding: previousEndsWithLineEnding,
  });
}
