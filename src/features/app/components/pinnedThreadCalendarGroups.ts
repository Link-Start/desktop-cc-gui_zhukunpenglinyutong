import type { ThreadSummary } from "../../../types";

export type PinnedThreadCalendarRow = {
  thread: ThreadSummary;
  depth: number;
  hasChildren?: boolean;
  workspaceId: string;
  workspacePath: string;
};

export type PinnedWorkspaceRun = {
  key: string;
  workspaceId: string;
  workspacePath: string;
  rootCount: number;
  rows: Array<{
    thread: ThreadSummary;
    depth: number;
    hasChildren?: boolean;
  }>;
};

export type PinnedCalendarDayGroup = {
  dateKey: string;
  rootCount: number;
  workspaceRuns: PinnedWorkspaceRun[];
};

export function formatPinnedCalendarDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "1970-01-01";
  }
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resolveFamilyDateById(
  rows: PinnedThreadCalendarRow[],
): Map<string, string> {
  const membersByFamily = new Map<string, PinnedThreadCalendarRow[]>();
  for (const row of rows) {
    if (row.depth !== 0) {
      continue;
    }
    const familyId = row.thread.familyId;
    if (!familyId) {
      continue;
    }
    const members = membersByFamily.get(familyId);
    if (members) {
      members.push(row);
    } else {
      membersByFamily.set(familyId, [row]);
    }
  }

  const dateByFamily = new Map<string, string>();
  for (const [familyId, members] of membersByFamily) {
    const representative =
      members.find(
        (member) => member.thread.originKind !== "provider-continuation",
      ) ?? members[0];
    dateByFamily.set(
      familyId,
      formatPinnedCalendarDateKey(representative.thread.updatedAt),
    );
  }
  return dateByFamily;
}

function splitWorkspaceRuns(
  rows: PinnedThreadCalendarRow[],
): PinnedWorkspaceRun[] {
  const runs: PinnedWorkspaceRun[] = [];
  let current: PinnedWorkspaceRun | null = null;

  for (const row of rows) {
    if (
      !current ||
      current.workspaceId !== row.workspaceId ||
      current.workspacePath !== row.workspacePath
    ) {
      current = {
        key: `${row.workspaceId}:${row.thread.id}`,
        workspaceId: row.workspaceId,
        workspacePath: row.workspacePath,
        rootCount: 0,
        rows: [],
      };
      runs.push(current);
    }
    if (row.depth === 0) {
      current.rootCount += 1;
    }
    current.rows.push({
      thread: row.thread,
      depth: row.depth,
      hasChildren: row.hasChildren,
    });
  }

  return runs;
}

export function groupPinnedRowsByCalendarDay(
  rows: PinnedThreadCalendarRow[],
): PinnedCalendarDayGroup[] {
  const familyDateById = resolveFamilyDateById(rows);
  const rowsByDate = new Map<string, PinnedThreadCalendarRow[]>();
  let currentDateKey: string | null = null;

  for (const row of rows) {
    if (row.depth === 0) {
      currentDateKey =
        (row.thread.familyId
          ? familyDateById.get(row.thread.familyId)
          : null) ?? formatPinnedCalendarDateKey(row.thread.updatedAt);
    }
    const dateKey =
      currentDateKey ?? formatPinnedCalendarDateKey(row.thread.updatedAt);
    const bucket = rowsByDate.get(dateKey);
    if (bucket) {
      bucket.push(row);
    } else {
      rowsByDate.set(dateKey, [row]);
    }
  }

  return Array.from(rowsByDate.entries())
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([dateKey, dayRows]) => ({
      dateKey,
      rootCount: dayRows.filter((row) => row.depth === 0).length,
      workspaceRuns: splitWorkspaceRuns(dayRows),
    }));
}

export function findPinnedCalendarDateForThread(
  groups: PinnedCalendarDayGroup[],
  threadId: string | null,
): string | null {
  if (!threadId) {
    return null;
  }
  for (const group of groups) {
    for (const run of group.workspaceRuns) {
      if (run.rows.some((row) => row.thread.id === threadId)) {
        return group.dateKey;
      }
    }
  }
  return null;
}

export function resolvePinnedDayExpanded(
  dateKey: string,
  latestDateKey: string | null,
  collapsedDays: ReadonlySet<string>,
  expandedDays: ReadonlySet<string>,
): boolean {
  if (collapsedDays.has(dateKey)) {
    return false;
  }
  if (expandedDays.has(dateKey)) {
    return true;
  }
  return dateKey === latestDateKey;
}
