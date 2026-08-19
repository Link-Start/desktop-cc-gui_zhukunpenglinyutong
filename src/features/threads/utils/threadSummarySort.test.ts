import { describe, expect, it } from "vitest";

import {
  compareThreadSummariesByCreatedAtDesc,
  pickStableCreatedAt,
  resolveMergedThreadCreatedAt,
  resolveThreadCreatedAt,
} from "./threadSummarySort";

describe("threadSummarySort", () => {
  it("prefers createdAt over a newer updatedAt", () => {
    expect(
      resolveThreadCreatedAt({
        createdAt: 100,
        updatedAt: 9_000,
      }),
    ).toBe(100);
  });

  it("falls back to updatedAt when createdAt is missing", () => {
    expect(resolveThreadCreatedAt({ updatedAt: 250 })).toBe(250);
  });

  it("keeps the earliest known createdAt across merges", () => {
    expect(pickStableCreatedAt(800, 100, undefined, 400)).toBe(100);
  });

  it("sorts newest created sessions first and ignores updatedAt churn", () => {
    const older = {
      id: "old",
      name: "Old",
      createdAt: 100,
      updatedAt: 9_000,
    };
    const newer = {
      id: "new",
      name: "New",
      createdAt: 200,
      updatedAt: 300,
    };

    expect(compareThreadSummariesByCreatedAtDesc(older, newer)).toBeGreaterThan(
      0,
    );
    expect(
      [older, newer]
        .sort(compareThreadSummariesByCreatedAtDesc)
        .map((row) => row.id),
    ).toEqual(["new", "old"]);
  });

  it("does not lift a frozen createdAt with a later updatedAt", () => {
    expect(
      resolveMergedThreadCreatedAt(
        { createdAt: 40, updatedAt: 40 },
        { updatedAt: 900 },
      ),
    ).toBe(40);
  });

  it("freezes first-seen createdAt from createdAt then updatedAt", () => {
    expect(
      resolveMergedThreadCreatedAt(undefined, {
        createdAt: 20,
        updatedAt: 90,
      }),
    ).toBe(20);
    expect(
      resolveMergedThreadCreatedAt(undefined, {
        updatedAt: 70,
      }),
    ).toBe(70);
  });

  it("freezes an existing row that still lacks createdAt", () => {
    expect(
      resolveMergedThreadCreatedAt(
        { updatedAt: 50 },
        { updatedAt: 90 },
      ),
    ).toBe(50);
  });
});
