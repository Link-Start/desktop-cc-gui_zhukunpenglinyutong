import { describe, expect, it } from "vitest";

import type { ThreadSummary } from "../../../types";
import {
  projectContinuationFamilyRows,
  type ContinuationFamilyRow,
} from "./continuationFamilyRows";

function row(
  id: string,
  overrides: Partial<ThreadSummary> = {},
  depth = 0,
): ContinuationFamilyRow {
  return {
    thread: {
      id,
      name: id,
      updatedAt: 1,
      ...overrides,
    },
    depth,
  };
}

describe("projectContinuationFamilyRows", () => {
  it("makes an authoritative continuation family contiguous without reordering its members", () => {
    const result = projectContinuationFamilyRows([
      row("family-new", {
        familyId: "family-1",
        originKind: "provider-continuation",
        lineageKind: "provider-continuation",
        sourceSessionId: "family-root",
      }),
      row("unrelated"),
      row("family-root", { lineageKind: "root" }),
      row("tail"),
    ]);

    expect(result.map(({ thread }) => thread.id)).toEqual([
      "family-new",
      "family-root",
      "unrelated",
      "tail",
    ]);
    expect(result[0]?.continuationFamilySegment).toEqual({
      familyId: "family-1",
      memberCount: 2,
      position: "start",
    });
    expect(result[1]?.continuationFamilySegment?.position).toBe("end");
  });

  it("moves a root together with its visible subagent subtree", () => {
    const result = projectContinuationFamilyRows([
      {
        ...row("family-new", {
          familyId: "family-1",
          originKind: "provider-continuation",
          sourceSessionId: "family-root",
        }),
        hasChildren: true,
      },
      row("child", { parentThreadId: "family-new" }, 1),
      row("unrelated"),
      row("family-root"),
    ]);

    expect(result.map(({ thread }) => thread.id)).toEqual([
      "family-new",
      "child",
      "family-root",
      "unrelated",
    ]);
    expect(result[1]).toMatchObject({
      depth: 1,
      continuationFamilySegment: {
        memberCount: 2,
        position: "middle",
      },
    });
    expect(result[2]?.continuationFamilySegment?.position).toBe("end");
  });

  it("resolves the original legacy source through an authoritative continuation chain", () => {
    const result = projectContinuationFamilyRows([
      row("newest-continuation", {
        familyId: "family-1",
        familyRootSessionId: "stable:family-root",
        sourceSessionId: "earlier-continuation",
        lineageParentSessionId: "earlier-continuation",
        originKind: "provider-continuation",
        lineageKind: "provider-continuation",
      }),
      row("unrelated"),
      row("earlier-continuation", {
        familyId: "family-1",
        familyRootSessionId: "stable:family-root",
        sourceSessionId: "family-root",
        lineageParentSessionId: "family-root",
        originKind: "provider-continuation",
        lineageKind: "provider-continuation",
      }),
      row("family-root"),
    ]);

    expect(result.map(({ thread }) => thread.id)).toEqual([
      "newest-continuation",
      "earlier-continuation",
      "family-root",
      "unrelated",
    ]);
    expect(result[0]?.continuationFamilySegment?.memberCount).toBe(3);
    expect(result[2]?.continuationFamilySegment?.position).toBe("end");
  });

  it("uses a legacy source as the family anchor when it appears first", () => {
    const result = projectContinuationFamilyRows([
      row("family-root"),
      row("unrelated"),
      row("continuation", {
        familyId: "family-1",
        familyRootSessionId: "family-root",
        originKind: "provider-continuation",
      }),
    ]);

    expect(result.map(({ thread }) => thread.id)).toEqual([
      "family-root",
      "continuation",
      "unrelated",
    ]);
    expect(result[0]?.continuationFamilySegment).toMatchObject({
      memberCount: 2,
      position: "start",
    });
    expect(result[1]?.continuationFamilySegment?.position).toBe("end");
  });

  it("leaves a legacy source outside when distinct families claim it", () => {
    const result = projectContinuationFamilyRows([
      row("family-a-continuation", {
        familyId: "family-a",
        sourceSessionId: "shared-source",
        originKind: "provider-continuation",
      }),
      row("family-a-peer", {
        familyId: "family-a",
        originKind: "provider-continuation",
      }),
      row("shared-source"),
      row("family-b-continuation", {
        familyId: "family-b",
        sourceSessionId: "shared-source",
        originKind: "provider-continuation",
      }),
      row("family-b-peer", {
        familyId: "family-b",
        originKind: "provider-continuation",
      }),
    ]);

    expect(
      result.find(({ thread }) => thread.id === "shared-source")
        ?.continuationFamilySegment,
    ).toBeUndefined();
  });

  it("fails open for one visible member or an unsupported lineage kind", () => {
    const single = [
      row("single", {
        familyId: "family-1",
        originKind: "provider-continuation",
      }),
      row("unrelated"),
    ];
    expect(projectContinuationFamilyRows(single)).toBe(single);

    const unknownLineage = [
      row("continuation", {
        familyId: "family-2",
        originKind: "provider-continuation",
      }),
      row("future-fork", {
        familyId: "family-2",
        lineageKind: "future-lineage",
      }),
    ];
    expect(projectContinuationFamilyRows(unknownLineage)).toBe(unknownLineage);
  });

  it("does not group matching family ids across independent calls", () => {
    const pinned = [
      row("pinned", {
        familyId: "family-1",
        originKind: "provider-continuation",
        sourceSessionId: "source",
      }),
    ];
    const unpinned = [row("source")];

    expect(projectContinuationFamilyRows(pinned)).toBe(pinned);
    expect(projectContinuationFamilyRows(unpinned)).toBe(unpinned);
  });
});
