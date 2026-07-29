import type { ThreadSummary } from "../../../types";

export type ContinuationFamilyRow = {
  thread: ThreadSummary;
  depth: number;
  hasChildren?: boolean;
};

export type ContinuationFamilySegment = {
  familyId: string;
  memberCount: number;
  position: "start" | "middle" | "end";
};

export type PresentedContinuationFamilyRow<T extends ContinuationFamilyRow> =
  T & {
    continuationFamilySegment?: ContinuationFamilySegment;
  };

type RootBlock<T extends ContinuationFamilyRow> = {
  index: number;
  rows: T[];
  rootSessionId: string;
  familyId: string | null;
  sourceReferenceIds: string[];
  isContinuation: boolean;
  hasUnsupportedLineage: boolean;
};

const SUPPORTED_LINEAGE_KIND = "provider-continuation";
const KNOWN_LINEAGE_KINDS = new Set([
  "root",
  "user-fork",
  SUPPORTED_LINEAGE_KIND,
]);

function normalizeIdentifier(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function toRootBlocks<T extends ContinuationFamilyRow>(rows: T[]) {
  const blocks: RootBlock<T>[] = [];

  rows.forEach((row) => {
    if (row.depth === 0 || blocks.length === 0) {
      const lineageKind = row.thread.lineageKind?.trim() ?? "";
      const isContinuation =
        row.thread.originKind === SUPPORTED_LINEAGE_KIND ||
        lineageKind === SUPPORTED_LINEAGE_KIND;
      blocks.push({
        index: blocks.length,
        rows: [row],
        rootSessionId: row.thread.id.trim(),
        familyId:
          row.depth === 0 ? normalizeIdentifier(row.thread.familyId) : null,
        sourceReferenceIds: isContinuation
          ? [
              row.thread.sourceSessionId,
              row.thread.lineageParentSessionId,
              row.thread.familyRootSessionId,
            ].flatMap((value) => {
              const normalized = normalizeIdentifier(value);
              return normalized ? [normalized] : [];
            })
          : [],
        isContinuation,
        hasUnsupportedLineage:
          lineageKind.length > 0 && !KNOWN_LINEAGE_KINDS.has(lineageKind),
      });
      return;
    }

    blocks[blocks.length - 1]?.rows.push(row);
  });

  return blocks;
}

export function projectContinuationFamilyRows<
  T extends ContinuationFamilyRow,
>(rows: T[]): Array<PresentedContinuationFamilyRow<T>> {
  if (rows.length < 2) {
    return rows;
  }

  const blocks = toRootBlocks(rows);
  const blocksByFamilyId = new Map<string, RootBlock<T>[]>();
  const blocksByRootSessionId = new Map<string, RootBlock<T>[]>();

  blocks.forEach((block) => {
    const matchingRootBlocks =
      blocksByRootSessionId.get(block.rootSessionId) ?? [];
    matchingRootBlocks.push(block);
    blocksByRootSessionId.set(block.rootSessionId, matchingRootBlocks);

    if (!block.familyId) {
      return;
    }
    const familyBlocks = blocksByFamilyId.get(block.familyId);
    if (familyBlocks) {
      familyBlocks.push(block);
    } else {
      blocksByFamilyId.set(block.familyId, [block]);
    }
  });

  const familyClaimsBySourceBlock = new Map<RootBlock<T>, Set<string>>();
  blocksByFamilyId.forEach((familyBlocks, familyId) => {
    familyBlocks.forEach((block) => {
      if (!block.isContinuation) {
        return;
      }
      new Set(block.sourceReferenceIds).forEach((sourceReferenceId) => {
        const matchingSourceBlocks =
          blocksByRootSessionId.get(sourceReferenceId) ?? [];
        if (matchingSourceBlocks.length !== 1) {
          return;
        }
        const sourceBlock = matchingSourceBlocks[0];
        if (
          !sourceBlock ||
          sourceBlock.familyId ||
          sourceBlock.hasUnsupportedLineage
        ) {
          return;
        }
        const familyClaims =
          familyClaimsBySourceBlock.get(sourceBlock) ?? new Set<string>();
        familyClaims.add(familyId);
        familyClaimsBySourceBlock.set(sourceBlock, familyClaims);
      });
    });
  });

  const attachedFamilyIdBySourceBlock = new Map<RootBlock<T>, string>();
  familyClaimsBySourceBlock.forEach((familyClaims, sourceBlock) => {
    if (familyClaims.size !== 1) {
      return;
    }
    const [familyId] = familyClaims;
    if (!familyId) {
      return;
    }
    blocksByFamilyId.get(familyId)?.push(sourceBlock);
    attachedFamilyIdBySourceBlock.set(sourceBlock, familyId);
  });
  blocksByFamilyId.forEach((familyBlocks) => {
    familyBlocks.sort((left, right) => left.index - right.index);
  });

  const eligibleFamilyIds = new Set<string>();
  blocksByFamilyId.forEach((familyBlocks, familyId) => {
    if (
      familyBlocks.length >= 2 &&
      familyBlocks.some((block) => block.isContinuation) &&
      familyBlocks.every((block) => !block.hasUnsupportedLineage)
    ) {
      eligibleFamilyIds.add(familyId);
    }
  });

  if (eligibleFamilyIds.size === 0) {
    return rows;
  }

  const emittedFamilyIds = new Set<string>();
  const projectedRows: Array<PresentedContinuationFamilyRow<T>> = [];

  const appendFamily = (familyId: string) => {
    const familyBlocks = blocksByFamilyId.get(familyId) ?? [];
    const familyRows = familyBlocks.flatMap((block) => block.rows);
    const lastRowIndex = familyRows.length - 1;

    familyRows.forEach((row, rowIndex) => {
      projectedRows.push({
        ...row,
        continuationFamilySegment: {
          familyId,
          memberCount: familyBlocks.length,
          position:
            rowIndex === 0
              ? "start"
              : rowIndex === lastRowIndex
                ? "end"
                : "middle",
        },
      });
    });
  };

  blocks.forEach((block) => {
    const familyId =
      block.familyId ?? attachedFamilyIdBySourceBlock.get(block) ?? null;
    if (!familyId || !eligibleFamilyIds.has(familyId)) {
      projectedRows.push(...block.rows);
      return;
    }
    if (emittedFamilyIds.has(familyId)) {
      return;
    }
    emittedFamilyIds.add(familyId);
    appendFamily(familyId);
  });

  return projectedRows;
}
