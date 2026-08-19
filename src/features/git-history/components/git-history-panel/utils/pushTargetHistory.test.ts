import { describe, expect, it } from "vitest";
import {
  getPushTargetHistoryIdentity,
  getPushTargetHistoryStorageKey,
  isPushTargetHistoryMatch,
  parsePushTargetHistory,
  PUSH_TARGET_HISTORY_LIMIT,
  rememberPushTargetHistory,
  type GitPushTargetHistoryEntry,
} from "./pushTargetHistory";

function createHistoryEntry(
  overrides: Partial<GitPushTargetHistoryEntry> = {},
): GitPushTargetHistoryEntry {
  return {
    remote: "origin",
    branch: "main",
    pushToGerrit: false,
    topic: "",
    reviewers: "",
    cc: "",
    pushTags: false,
    runHooks: true,
    forceWithLease: false,
    ...overrides,
  };
}

describe("pushTargetHistory", () => {
  it("scopes storage keys by workspace", () => {
    expect(getPushTargetHistoryStorageKey("w1")).toBe("gitPushTargetHistory:w1");
  });

  it("parses valid history and drops incomplete entries", () => {
    expect(
      parsePushTargetHistory([
        createHistoryEntry({ remote: "upstream", branch: "feat/one", topic: "t1" }),
        { remote: "  ", branch: "main" },
        { remote: "origin" },
        "invalid",
        createHistoryEntry({ remote: "origin", branch: "main", runHooks: false }),
      ]),
    ).toEqual([
      createHistoryEntry({ remote: "upstream", branch: "feat/one", topic: "t1" }),
      createHistoryEntry({ remote: "origin", branch: "main", runHooks: false }),
    ]);
  });

  it("dedupes by destination and keeps the latest settings first", () => {
    const remembered = rememberPushTargetHistory(
      [
        createHistoryEntry({ remote: "origin", branch: "main", topic: "old" }),
        createHistoryEntry({ remote: "upstream", branch: "feat/two" }),
      ],
      createHistoryEntry({
        remote: "origin",
        branch: "main",
        topic: "new",
        reviewers: "alice",
      }),
    );

    expect(remembered).toHaveLength(2);
    expect(remembered[0]).toEqual(
      createHistoryEntry({
        remote: "origin",
        branch: "main",
        topic: "new",
        reviewers: "alice",
      }),
    );
    expect(remembered[1]?.remote).toBe("upstream");
  });

  it("keeps Gerrit and plain push to the same branch as separate records", () => {
    const remembered = rememberPushTargetHistory(
      [createHistoryEntry({ remote: "origin", branch: "main" })],
      createHistoryEntry({
        remote: "origin",
        branch: "main",
        pushToGerrit: true,
        topic: "review",
      }),
    );

    expect(remembered).toHaveLength(2);
    expect(
      getPushTargetHistoryIdentity(remembered[0] as GitPushTargetHistoryEntry),
    ).not.toBe(
      getPushTargetHistoryIdentity(remembered[1] as GitPushTargetHistoryEntry),
    );
  });

  it("caps history at three records", () => {
    const remembered = rememberPushTargetHistory(
      [
        createHistoryEntry({ branch: "one" }),
        createHistoryEntry({ branch: "two" }),
        createHistoryEntry({ branch: "three" }),
      ],
      createHistoryEntry({ branch: "four" }),
    );

    expect(remembered).toHaveLength(PUSH_TARGET_HISTORY_LIMIT);
    expect(remembered.map((entry) => entry.branch)).toEqual(["four", "one", "two"]);
  });

  it("matches the current dialog destination", () => {
    expect(
      isPushTargetHistoryMatch(
        createHistoryEntry({ remote: "upstream", branch: "feat/one" }),
        { remote: "upstream", branch: "feat/one", pushToGerrit: false },
      ),
    ).toBe(true);
    expect(
      isPushTargetHistoryMatch(
        createHistoryEntry({ remote: "upstream", branch: "feat/one" }),
        { remote: "origin", branch: "feat/one", pushToGerrit: false },
      ),
    ).toBe(false);
  });
});
