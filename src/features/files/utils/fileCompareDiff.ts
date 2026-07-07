export type FileCompareLineChange = {
  rowIndex: number;
  lineNumbersByColumn: Array<number | null>;
};

export type FileCompareLineGap = {
  lineNumber: number;
  count: number;
};

type FileCompareAlignedCell = {
  lineNumber: number;
  value: string;
} | null;

export type FileCompareDiffResult = {
  rowCount: number;
  changedRows: FileCompareLineChange[];
  changedLineNumbersByColumn: number[][];
  gapLineCountsByColumn: FileCompareLineGap[][];
};

function splitCompareLines(text: string): string[] {
  if (text.length === 0) {
    return [];
  }
  return text.split(/\r\n|\n|\r/);
}

function isChangedRow(rowValues: string[]) {
  const first = rowValues[0] ?? "";
  return rowValues.some((value) => value !== first);
}

function commonPrefixLength(left: string, right: string) {
  const maxLength = Math.min(left.length, right.length);
  let index = 0;
  while (index < maxLength && left[index] === right[index]) {
    index += 1;
  }
  return index;
}

function getAssignmentKey(line: string) {
  const separatorIndex = line.indexOf("=");
  return separatorIndex > 0 ? line.slice(0, separatorIndex).trim() : "";
}

function areLikelyReplacementLines(left: string, right: string) {
  const trimmedLeft = left.trim();
  const trimmedRight = right.trim();
  if (!trimmedLeft || !trimmedRight) {
    return false;
  }
  const leftAssignmentKey = getAssignmentKey(trimmedLeft);
  const rightAssignmentKey = getAssignmentKey(trimmedRight);
  if (leftAssignmentKey && leftAssignmentKey === rightAssignmentKey) {
    return true;
  }
  return commonPrefixLength(trimmedLeft, trimmedRight) >= Math.min(4, trimmedLeft.length, trimmedRight.length);
}

function getSubstitutionCost(left: string, right: string) {
  if (left === right) {
    return 0;
  }
  return areLikelyReplacementLines(left, right) ? 1 : 2;
}

type AlignOperation =
  | { kind: "pair"; baseIndex: number; targetIndex: number }
  | { kind: "base-only"; baseIndex: number }
  | { kind: "target-only"; targetIndex: number; beforeBaseIndex: number };

const ALIGNMENT_CELL_LIMIT = 800_000;

function alignTargetToBase(baseLines: string[], targetLines: string[]): AlignOperation[] | null {
  if (baseLines.length * targetLines.length > ALIGNMENT_CELL_LIMIT) {
    return null;
  }
  const width = targetLines.length + 1;
  const costs = new Uint32Array((baseLines.length + 1) * width);
  const at = (baseIndex: number, targetIndex: number) => baseIndex * width + targetIndex;

  for (let baseIndex = 0; baseIndex <= baseLines.length; baseIndex += 1) {
    costs[at(baseIndex, 0)] = baseIndex;
  }
  for (let targetIndex = 0; targetIndex <= targetLines.length; targetIndex += 1) {
    costs[at(0, targetIndex)] = targetIndex;
  }

  for (let baseIndex = 1; baseIndex <= baseLines.length; baseIndex += 1) {
    for (let targetIndex = 1; targetIndex <= targetLines.length; targetIndex += 1) {
      const substitutionCost = getSubstitutionCost(
        baseLines[baseIndex - 1] ?? "",
        targetLines[targetIndex - 1] ?? "",
      );
      const replaceCost = costs[at(baseIndex - 1, targetIndex - 1)] + substitutionCost;
      const deleteCost = costs[at(baseIndex - 1, targetIndex)] + 1;
      const insertCost = costs[at(baseIndex, targetIndex - 1)] + 1;
      costs[at(baseIndex, targetIndex)] = Math.min(replaceCost, deleteCost, insertCost);
    }
  }

  const operations: AlignOperation[] = [];
  let baseIndex = baseLines.length;
  let targetIndex = targetLines.length;
  while (baseIndex > 0 || targetIndex > 0) {
    if (baseIndex > 0 && targetIndex > 0) {
      const substitutionCost = getSubstitutionCost(
        baseLines[baseIndex - 1] ?? "",
        targetLines[targetIndex - 1] ?? "",
      );
      if (
        substitutionCost < 2 &&
        costs[at(baseIndex, targetIndex)] ===
        costs[at(baseIndex - 1, targetIndex - 1)] + substitutionCost
      ) {
        operations.push({
          kind: "pair",
          baseIndex: baseIndex - 1,
          targetIndex: targetIndex - 1,
        });
        baseIndex -= 1;
        targetIndex -= 1;
        continue;
      }
    }
    if (
      baseIndex > 0 &&
      costs[at(baseIndex, targetIndex)] === costs[at(baseIndex - 1, targetIndex)] + 1
    ) {
      operations.push({ kind: "base-only", baseIndex: baseIndex - 1 });
      baseIndex -= 1;
      continue;
    }
    if (targetIndex > 0) {
      operations.push({
        kind: "target-only",
        targetIndex: targetIndex - 1,
        beforeBaseIndex: baseIndex,
      });
      targetIndex -= 1;
      continue;
    }
    if (baseIndex > 0 && targetIndex > 0) {
      operations.push({
        kind: "pair",
        baseIndex: baseIndex - 1,
        targetIndex: targetIndex - 1,
      });
      baseIndex -= 1;
      targetIndex -= 1;
      continue;
    }
  }

  return operations.reverse();
}

function computeIndexAlignedRows(lineSets: string[][]): FileCompareAlignedCell[][] {
  const rowCount = lineSets.reduce(
    (maxRows, lines) => Math.max(maxRows, lines.length),
    0,
  );
  return Array.from({ length: rowCount }, (_unused, rowIndex) =>
    lineSets.map((lines) =>
      rowIndex < lines.length
        ? { lineNumber: rowIndex + 1, value: lines[rowIndex] ?? "" }
        : null,
    ),
  );
}

function computeAnchorAlignedRows(lineSets: string[][]): FileCompareAlignedCell[][] | null {
  if (lineSets.length === 0) {
    return [];
  }
  const baseLines = lineSets[0] ?? [];
  const targetAlignments = lineSets.slice(1).map((targetLines) =>
    alignTargetToBase(baseLines, targetLines),
  );
  if (targetAlignments.some((alignment) => alignment === null)) {
    return null;
  }
  const rows: FileCompareAlignedCell[][] = [];
  const insertionRowsByBaseIndex = new Map<number, FileCompareAlignedCell[][]>();
  const rowByBaseIndex = new Map<number, FileCompareAlignedCell[]>();

  const ensureInsertionRow = (beforeBaseIndex: number, insertionIndex: number) => {
    const existingRows = insertionRowsByBaseIndex.get(beforeBaseIndex) ?? [];
    while (existingRows.length <= insertionIndex) {
      existingRows.push(lineSets.map(() => null) as FileCompareAlignedCell[]);
    }
    insertionRowsByBaseIndex.set(beforeBaseIndex, existingRows);
    return existingRows[insertionIndex]!;
  };

  for (let baseIndex = 0; baseIndex < baseLines.length; baseIndex += 1) {
    const row = lineSets.map(() => null) as FileCompareAlignedCell[];
    row[0] = { lineNumber: baseIndex + 1, value: baseLines[baseIndex] ?? "" };
    rowByBaseIndex.set(baseIndex, row);
  }

  targetAlignments.forEach((alignment, targetOffset) => {
    const columnIndex = targetOffset + 1;
    const insertionCursorByBaseIndex = new Map<number, number>();
    for (const operation of alignment ?? []) {
      if (operation.kind === "pair") {
        const row = rowByBaseIndex.get(operation.baseIndex);
        if (row) {
          row[columnIndex] = {
            lineNumber: operation.targetIndex + 1,
            value: lineSets[columnIndex]?.[operation.targetIndex] ?? "",
          };
        }
        continue;
      }
      if (operation.kind === "base-only") {
        continue;
      }
      const nextInsertionIndex =
        insertionCursorByBaseIndex.get(operation.beforeBaseIndex) ?? 0;
      const row = ensureInsertionRow(operation.beforeBaseIndex, nextInsertionIndex);
      row[columnIndex] = {
        lineNumber: operation.targetIndex + 1,
        value: lineSets[columnIndex]?.[operation.targetIndex] ?? "",
      };
      insertionCursorByBaseIndex.set(operation.beforeBaseIndex, nextInsertionIndex + 1);
    }
  });

  for (let baseIndex = 0; baseIndex <= baseLines.length; baseIndex += 1) {
    const insertionRows = insertionRowsByBaseIndex.get(baseIndex) ?? [];
    rows.push(...insertionRows);
    const baseRow = rowByBaseIndex.get(baseIndex);
    if (baseRow) {
      rows.push(baseRow);
    }
  }

  return rows;
}

function buildGapLineCountsByColumn(
  rows: FileCompareAlignedCell[][],
  lineSets: string[][],
): FileCompareLineGap[][] {
  return lineSets.map((lines, columnIndex) => {
    const gaps: FileCompareLineGap[] = [];
    let pendingGapCount = 0;
    for (const row of rows) {
      const cell = row[columnIndex];
      if (!cell) {
        pendingGapCount += 1;
        continue;
      }
      if (pendingGapCount > 0) {
        gaps.push({ lineNumber: cell.lineNumber, count: pendingGapCount });
        pendingGapCount = 0;
      }
    }
    if (pendingGapCount > 0) {
      gaps.push({ lineNumber: lines.length + 1, count: pendingGapCount });
    }
    return gaps;
  });
}

export function computeFileCompareDiff(texts: string[]): FileCompareDiffResult {
  const lineSets = texts.map(splitCompareLines);
  const alignedRows =
    computeAnchorAlignedRows(lineSets) ?? computeIndexAlignedRows(lineSets);
  const changedRows: FileCompareLineChange[] = [];
  const changedLineNumberSets = texts.map(() => new Set<number>());
  const gapLineCountsByColumn = buildGapLineCountsByColumn(alignedRows, lineSets);

  for (let rowIndex = 0; rowIndex < alignedRows.length; rowIndex += 1) {
    const row = alignedRows[rowIndex] ?? [];
    const rowValues = row.map((cell) => cell?.value ?? "");
    const lineNumbersByColumn = row.map((cell) => cell?.lineNumber ?? null);
    const hasGap = row.some((cell) => cell === null);
    if (!hasGap && !isChangedRow(rowValues)) {
      continue;
    }
    changedRows.push({
      rowIndex,
      lineNumbersByColumn,
    });
    lineNumbersByColumn.forEach((lineNumber, columnIndex) => {
      if (lineNumber !== null) {
        changedLineNumberSets[columnIndex]?.add(lineNumber);
      }
    });
  }

  return {
    rowCount: alignedRows.length,
    changedRows,
    changedLineNumbersByColumn: changedLineNumberSets.map((lineNumbers) =>
      Array.from(lineNumbers).sort((left, right) => left - right),
    ),
    gapLineCountsByColumn,
  };
}
