import { describe, expect, it } from "vitest";
import {
  collectOccupiedGrokSessionIds,
  pickLikelyGrokSessionId,
} from "./threadMessagingHelpers";

describe("pickLikelyGrokSessionId occupied sessions", () => {
  it("does not bind a session already owned by another mossx thread", () => {
    const sessions = [
      { sessionId: "occupied-session", updatedAt: 2_000 },
    ];

    expect(
      pickLikelyGrokSessionId(sessions, 1_000, new Set(["occupied-session"])),
    ).toBeNull();
  });

  it("still binds the only recent unoccupied session", () => {
    const sessions = [
      { sessionId: "old-session", updatedAt: 500 },
      { sessionId: "fresh-session", updatedAt: 2_000 },
    ];

    expect(
      pickLikelyGrokSessionId(sessions, 1_000, new Set(["old-session"])),
    ).toBe("fresh-session");
  });

  it("collects remapped grok threads and other pending caches as occupied", () => {
    const occupancy = collectOccupiedGrokSessionIds({
      itemsByThread: {
        "grok:old-session": [{ id: "hist-1", kind: "message", role: "user", text: "昨天" }],
        "grok-pending-old": [
          {
            id: "foreign-explore",
            kind: "explore",
            status: "exploring",
            entries: [{ kind: "list", label: "Downloads" }],
          },
        ],
        "grok-pending-new": [{ id: "opt-1", kind: "message", role: "user", text: "在吗" }],
      },
      pendingSessionIdByThread: new Map([
        ["grok-pending-old", "failed-session"],
      ]),
      currentThreadId: "grok-pending-new",
    });

    expect(occupancy.occupiedSessionIds.has("old-session")).toBe(true);
    expect(occupancy.occupiedSessionIds.has("failed-session")).toBe(true);
    expect(occupancy.hasOtherPendingWithItems).toBe(true);
  });

  it("does not treat an old remapped grok thread as a reason to skip pickLikely", () => {
    const occupancy = collectOccupiedGrokSessionIds({
      itemsByThread: {
        "grok:yesterday": [{ id: "hist-1", kind: "message", role: "user", text: "昨天" }],
        "grok-pending-new": [],
      },
      pendingSessionIdByThread: new Map(),
      currentThreadId: "grok-pending-new",
    });

    expect(occupancy.occupiedSessionIds.has("yesterday")).toBe(true);
    expect(occupancy.hasOtherPendingWithItems).toBe(false);
  });
});
