import { describe, expect, it } from "vitest";
import type { ThreadSummary } from "../../../types";
import {
  findPinnedCalendarDateForThread,
  formatPinnedCalendarDateKey,
  groupPinnedRowsByCalendarDay,
  resolvePinnedDayExpanded,
} from "./pinnedThreadCalendarGroups";

function localStamp(year: number, month: number, day: number, hour = 12) {
  return new Date(year, month - 1, day, hour, 0, 0).getTime();
}

function thread(
  id: string,
  stamp: number,
  extra: Partial<ThreadSummary> = {},
): ThreadSummary {
  return { id, name: id, updatedAt: stamp, ...extra };
}

describe("pinnedThreadCalendarGroups", () => {
  it("formats local calendar days as yyyy-mm-dd", () => {
    expect(formatPinnedCalendarDateKey(localStamp(2026, 8, 18))).toBe(
      "2026-08-18",
    );
    expect(formatPinnedCalendarDateKey(Number.NaN)).toBe("1970-01-01");
  });

  it("groups by root updatedAt day and keeps pin order inside a day", () => {
    const latest = localStamp(2026, 8, 18);
    const older = localStamp(2026, 8, 17);
    const groups = groupPinnedRowsByCalendarDay([
      {
        thread: thread("older-first", older),
        depth: 0,
        workspaceId: "ws-1",
        workspacePath: "/tmp/ws-1",
      },
      {
        thread: thread("latest-a", latest),
        depth: 0,
        workspaceId: "ws-1",
        workspacePath: "/tmp/ws-1",
      },
      {
        thread: thread("latest-b", latest, { name: "later pin" }),
        depth: 0,
        workspaceId: "ws-2",
        workspacePath: "/tmp/ws-2",
      },
    ]);

    expect(groups.map((group) => group.dateKey)).toEqual([
      "2026-08-18",
      "2026-08-17",
    ]);
    expect(groups[0]?.rootCount).toBe(2);
    expect(groups[0]?.workspaceRuns.map((run) => run.workspaceId)).toEqual([
      "ws-1",
      "ws-2",
    ]);
    expect(groups[1]?.workspaceRuns[0]?.rows[0]?.thread.id).toBe("older-first");
  });

  it("keeps children with the root day even when the child is newer", () => {
    const groups = groupPinnedRowsByCalendarDay([
      {
        thread: thread("parent", localStamp(2026, 8, 17)),
        depth: 0,
        hasChildren: true,
        workspaceId: "ws-1",
        workspacePath: "/tmp/ws-1",
      },
      {
        thread: thread("child", localStamp(2026, 8, 18)),
        depth: 1,
        workspaceId: "ws-1",
        workspacePath: "/tmp/ws-1",
      },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.dateKey).toBe("2026-08-17");
    expect(groups[0]?.workspaceRuns[0]?.rows.map((row) => row.thread.id)).toEqual(
      ["parent", "child"],
    );
  });

  it("keeps continuation family members on the representative day", () => {
    const groups = groupPinnedRowsByCalendarDay([
      {
        thread: thread("continuation", localStamp(2026, 8, 18), {
          familyId: "family-1",
          originKind: "provider-continuation",
          sourceSessionId: "source",
        }),
        depth: 0,
        workspaceId: "ws-1",
        workspacePath: "/tmp/ws-1",
      },
      {
        thread: thread("source", localStamp(2026, 8, 17), {
          familyId: "family-1",
        }),
        depth: 0,
        workspaceId: "ws-1",
        workspacePath: "/tmp/ws-1",
      },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.dateKey).toBe("2026-08-17");
    expect(groups[0]?.rootCount).toBe(2);
  });

  it("finds the calendar day for an active thread", () => {
    const groups = groupPinnedRowsByCalendarDay([
      {
        thread: thread("today", localStamp(2026, 8, 18)),
        depth: 0,
        workspaceId: "ws-1",
        workspacePath: "/tmp/ws-1",
      },
      {
        thread: thread("yesterday", localStamp(2026, 8, 17)),
        depth: 0,
        workspaceId: "ws-1",
        workspacePath: "/tmp/ws-1",
      },
    ]);

    expect(findPinnedCalendarDateForThread(groups, "yesterday")).toBe(
      "2026-08-17",
    );
    expect(findPinnedCalendarDateForThread(groups, null)).toBeNull();
  });

  it("opens only the latest day unless the user overrode it", () => {
    expect(
      resolvePinnedDayExpanded("2026-08-18", "2026-08-18", new Set(), new Set()),
    ).toBe(true);
    expect(
      resolvePinnedDayExpanded("2026-08-17", "2026-08-18", new Set(), new Set()),
    ).toBe(false);
    expect(
      resolvePinnedDayExpanded(
        "2026-08-18",
        "2026-08-18",
        new Set(["2026-08-18"]),
        new Set(),
      ),
    ).toBe(false);
    expect(
      resolvePinnedDayExpanded(
        "2026-08-17",
        "2026-08-18",
        new Set(),
        new Set(["2026-08-17"]),
      ),
    ).toBe(true);
  });
});
