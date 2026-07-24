import { describe, expect, it } from "vitest";
import {
  RADAR_RECENT_GLOBAL_LIMIT,
  RADAR_RECENT_TTL_MS,
  RADAR_RECENT_WORKSPACE_LIMIT,
  applyRadarRecentBounds,
  mergePersistedRadarRecentEntries,
  type PersistedRadarRecentEntry,
} from "./sessionRadarPersistence";

function createEntry(
  workspaceId: string,
  threadId: string,
  completedAt: number,
): PersistedRadarRecentEntry {
  return {
    id: `${workspaceId}:${threadId}`,
    workspaceId,
    threadId,
    completedAt,
    updatedAt: completedAt,
    startedAt: null,
    durationMs: null,
  };
}

describe("applyRadarRecentBounds", () => {
  it("prunes entries older than the 30-day TTL", () => {
    const now = 100_000_000_000;
    const fresh = createEntry("ws-a", "t-fresh", now - 1000);
    const expired = createEntry("ws-a", "t-expired", now - RADAR_RECENT_TTL_MS - 1000);

    const result = applyRadarRecentBounds([expired, fresh], now);

    expect(result.entries.map((entry) => entry.id)).toEqual([fresh.id]);
    expect(result.prunedEntryIds).toEqual([expired.id]);
  });

  it("keeps the newest entries per workspace within the workspace limit", () => {
    const now = 100_000_000_000;
    const entries = Array.from({ length: RADAR_RECENT_WORKSPACE_LIMIT + 10 }, (_, index) =>
      createEntry("ws-a", `t-${index}`, now - index * 1000),
    );

    const result = applyRadarRecentBounds(entries, now);

    expect(result.entries).toHaveLength(RADAR_RECENT_WORKSPACE_LIMIT);
    expect(result.entries[0]?.id).toBe("ws-a:t-0");
    expect(result.prunedEntryIds).toHaveLength(10);
    expect(result.prunedEntryIds).toContain(`ws-a:t-${RADAR_RECENT_WORKSPACE_LIMIT + 9}`);
    expect(result.prunedEntryIds).not.toContain("ws-a:t-0");
  });

  it("keeps the newest entries across workspaces within the global limit", () => {
    const now = 100_000_000_000;
    const entries = Array.from({ length: RADAR_RECENT_GLOBAL_LIMIT + 5 }, (_, index) =>
      createEntry(`ws-${index}`, "t-1", now - index * 1000),
    );

    const result = applyRadarRecentBounds(entries, now);

    expect(result.entries).toHaveLength(RADAR_RECENT_GLOBAL_LIMIT);
    expect(result.prunedEntryIds).toHaveLength(5);
    expect(result.entries.some((entry) => entry.id === `ws-${RADAR_RECENT_GLOBAL_LIMIT}:t-1`)).toBe(
      false,
    );
  });

  it("applies the workspace limit before consuming global capacity", () => {
    const now = 100_000_000_000;
    const crowded = Array.from({ length: RADAR_RECENT_WORKSPACE_LIMIT + 5 }, (_, index) =>
      createEntry("ws-crowded", `t-${index}`, now - index * 1000),
    );
    const other = createEntry("ws-other", "t-1", now - 60_000_000);

    const result = applyRadarRecentBounds([...crowded, other], now);

    expect(result.entries.filter((entry) => entry.workspaceId === "ws-crowded")).toHaveLength(
      RADAR_RECENT_WORKSPACE_LIMIT,
    );
    expect(result.entries.some((entry) => entry.id === other.id)).toBe(true);
  });

  it("does not prune when entry count equals the workspace limit exactly", () => {
    const now = 100_000_000_000;
    const entries = Array.from({ length: RADAR_RECENT_WORKSPACE_LIMIT }, (_, index) =>
      createEntry("ws-a", `t-${index}`, now - index * 1000),
    );

    const result = applyRadarRecentBounds(entries, now);

    expect(result.entries).toHaveLength(RADAR_RECENT_WORKSPACE_LIMIT);
    expect(result.prunedEntryIds).toEqual([]);
  });

  it("does not prune when entry count equals the global limit exactly", () => {
    const now = 100_000_000_000;
    const entries = Array.from({ length: RADAR_RECENT_GLOBAL_LIMIT }, (_, index) =>
      createEntry(`ws-${index}`, "t-1", now - index * 1000),
    );

    const result = applyRadarRecentBounds(entries, now);

    expect(result.entries).toHaveLength(RADAR_RECENT_GLOBAL_LIMIT);
    expect(result.prunedEntryIds).toEqual([]);
  });
});

describe("mergePersistedRadarRecentEntries", () => {
  it("keeps the newer completion when persisted and live entries share an id", () => {
    const now = 100_000_000_000;
    const persisted = [createEntry("ws-a", "t-1", now - 5000)];
    const completed = [createEntry("ws-a", "t-1", now - 1000)];

    const result = mergePersistedRadarRecentEntries(persisted, completed, now);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.completedAt).toBe(now - 1000);
    expect(result.prunedEntryIds).toEqual([]);
  });

  it("does not replace a newer persisted entry with an older live completion", () => {
    const now = 100_000_000_000;
    const persisted = [createEntry("ws-a", "t-1", now - 1000)];
    const completed = [createEntry("ws-a", "t-1", now - 5000)];

    const result = mergePersistedRadarRecentEntries(persisted, completed, now);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.completedAt).toBe(now - 1000);
  });

  it("drops malformed legacy entries while pruning oversized stores lazily", () => {
    const now = 100_000_000_000;
    const legacyStore: unknown[] = [
      null,
      { id: 42 },
      { id: "broken", workspaceId: "ws-a" },
      ...Array.from({ length: RADAR_RECENT_WORKSPACE_LIMIT + 2 }, (_, index) =>
        createEntry("ws-a", `t-${index}`, now - index * 1000),
      ),
    ];

    const result = mergePersistedRadarRecentEntries(legacyStore, [], now);

    expect(result.entries).toHaveLength(RADAR_RECENT_WORKSPACE_LIMIT);
    expect(result.prunedEntryIds).toHaveLength(2);
    expect(result.entries.every((entry) => typeof entry.completedAt === "number")).toBe(true);
  });

  it("prunes expired persisted entries on merge and reports their ids", () => {
    const now = 100_000_000_000;
    const persisted = [
      createEntry("ws-a", "t-expired", now - RADAR_RECENT_TTL_MS - 1),
      createEntry("ws-a", "t-fresh", now - 1000),
    ];

    const result = mergePersistedRadarRecentEntries(persisted, [], now);

    expect(result.entries.map((entry) => entry.id)).toEqual(["ws-a:t-fresh"]);
    expect(result.prunedEntryIds).toEqual(["ws-a:t-expired"]);
  });
});
