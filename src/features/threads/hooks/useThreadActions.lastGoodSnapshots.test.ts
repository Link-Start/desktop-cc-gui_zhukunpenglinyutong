import { describe, expect, it } from "vitest";
import type { ThreadSummary } from "../../../types";
import type { WorkspaceSessionCatalogSourceStatus } from "../../../services/tauri";
import {
  THREAD_ENGINE_SOURCES,
  flattenLastGoodEngineSnapshots,
  hasAuthoritativeCatalogMembershipProof,
  resolveLastGoodFloorProjection,
  unionIndexWithNewerLastGood,
} from "./useThreadActions.lastGoodSnapshots";

function summary(
  id: string,
  engineSource: ThreadSummary["engineSource"],
  updatedAt: number,
): ThreadSummary {
  return {
    id,
    name: id,
    createdAt: updatedAt,
    updatedAt,
    engineSource,
  } as ThreadSummary;
}

describe("last-good engine snapshots", () => {
  it("keeps PI in the continuity engine set", () => {
    expect(THREAD_ENGINE_SOURCES).toContain("pi");
  });

  it("flattens PI last-good rows instead of dropping them", () => {
    const flattened = flattenLastGoodEngineSnapshots({
      claude: [summary("claude:1", "claude", 10)],
      pi: [summary("pi:1", "pi", 20)],
    });

    expect(flattened.map((entry) => entry.id)).toEqual(["pi:1", "claude:1"]);
  });
});

describe("unionIndexWithNewerLastGood", () => {
  it("keeps Index A,B and last-good C", () => {
    const index = [
      summary("claude:a", "claude", 10),
      summary("claude:b", "claude", 11),
    ];
    const lastGood = [
      summary("claude:a", "claude", 9),
      summary("claude:b", "claude", 10),
      summary("claude:c", "claude", 20),
    ];

    const visible = unionIndexWithNewerLastGood(index, lastGood);

    expect(visible.map((entry) => entry.id).sort()).toEqual([
      "claude:a",
      "claude:b",
      "claude:c",
    ]);
  });

  it("lets a newer Index row win over older last-good", () => {
    const index = [summary("claude:a", "claude", 50)];
    const lastGood = [
      { ...summary("claude:a", "claude", 10), name: "stale-title" },
    ];

    const visible = unionIndexWithNewerLastGood(index, lastGood);

    expect(visible).toHaveLength(1);
    expect(visible[0]?.updatedAt).toBe(50);
    expect(visible[0]?.name).toBe("claude:a");
  });

  it("does not resurrect tombstoned or user-deleted last-good rows", () => {
    const index = [summary("claude:a", "claude", 10)];
    const lastGood = [
      summary("claude:a", "claude", 10),
      summary("claude:deleted", "claude", 99),
    ];
    const visible = resolveLastGoodFloorProjection({
      indexSummaries: index,
      lastGoodSummaries: lastGood,
      hasAuthoritativeEmptyCatalog: false,
      excludedThreadIds: new Set(["claude:deleted"]),
    }).visibleSummaries;

    expect(visible.map((entry) => entry.id)).toEqual(["claude:a"]);
  });

  it("does not resurrect last-good when catalog is authoritatively empty", () => {
    const lastGood = [summary("claude:old", "claude", 40)];
    const projection = resolveLastGoodFloorProjection({
      indexSummaries: [],
      lastGoodSummaries: lastGood,
      hasAuthoritativeEmptyCatalog: true,
    });

    expect(projection.visibleSummaries).toEqual([]);
    expect(projection.rememberCandidates).toEqual([]);
  });

  it("paints last-good on empty timeout without promoting authority", () => {
    const lastGood = [summary("claude:c", "claude", 20)];
    const projection = resolveLastGoodFloorProjection({
      indexSummaries: [],
      lastGoodSummaries: lastGood,
      hasAuthoritativeEmptyCatalog: false,
    });

    expect(projection.visibleSummaries.map((entry) => entry.id)).toEqual([
      "claude:c",
    ]);
    expect(projection.rememberCandidates).toBeNull();
  });

  it("does not treat a forced partial empty tick as authoritative empty", () => {
    const statuses: WorkspaceSessionCatalogSourceStatus[] = [
      {
        engine: "claude",
        completeness: "partial",
        source: "session-index",
      } as WorkspaceSessionCatalogSourceStatus,
    ];
    expect(hasAuthoritativeCatalogMembershipProof(statuses)).toBe(false);
    const projection = resolveLastGoodFloorProjection({
      indexSummaries: [],
      lastGoodSummaries: [summary("claude:keep", "claude", 8)],
      hasAuthoritativeEmptyCatalog: hasAuthoritativeCatalogMembershipProof(
        statuses,
      ),
    });
    expect(projection.visibleSummaries.map((entry) => entry.id)).toEqual([
      "claude:keep",
    ]);
    expect(projection.rememberCandidates).toBeNull();
  });
});
