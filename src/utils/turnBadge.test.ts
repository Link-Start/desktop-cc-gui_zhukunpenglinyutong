import { describe, expect, it } from "vitest";
import {
  buildTurnTargetBadgeKey,
  buildTurnTargetBadgeVisibleItemIds,
  type TurnBadgeSnapshot,
} from "./turnBadge";

function assistant(
  id: string,
  snapshot: TurnBadgeSnapshot | null,
) {
  return {
    id,
    kind: "message" as const,
    role: "assistant" as const,
    executionTargetSnapshot: snapshot,
  };
}

function user(id: string) {
  return {
    id,
    kind: "message" as const,
    role: "user" as const,
  };
}

const grokLocal: TurnBadgeSnapshot = {
  engine: "grok",
  providerProfileId: null,
  providerProfileNameSnapshot: "本地配置",
  providerProfileSource: "local",
  model: "grok",
};

const claudeA: TurnBadgeSnapshot = {
  engine: "claude",
  providerProfileId: "provider-a",
  providerProfileNameSnapshot: "Provider A",
  providerProfileSource: "managed",
  model: "sonnet-a",
  reasoning: { effort: "high" },
};

const claudeB: TurnBadgeSnapshot = {
  engine: "claude",
  providerProfileId: "provider-b",
  providerProfileNameSnapshot: "Provider B",
  providerProfileSource: "managed",
  model: "sonnet-b",
};

describe("buildTurnTargetBadgeKey", () => {
  it("stable for identical identity fields", () => {
    expect(buildTurnTargetBadgeKey(grokLocal)).toBe(
      buildTurnTargetBadgeKey({ ...grokLocal }),
    );
  });

  it("differs when model changes", () => {
    expect(buildTurnTargetBadgeKey(grokLocal)).not.toBe(
      buildTurnTargetBadgeKey({ ...grokLocal, model: "grok-2" }),
    );
  });
});

describe("buildTurnTargetBadgeVisibleItemIds", () => {
  it("shows only the first consecutive same-target assistant within a turn", () => {
    const visible = buildTurnTargetBadgeVisibleItemIds([
      assistant("a1", grokLocal),
      assistant("a2", grokLocal),
      assistant("a3", grokLocal),
    ]);
    expect([...visible]).toEqual(["a1"]);
  });

  it("re-shows badge after each user message even when target is unchanged (policy B)", () => {
    const visible = buildTurnTargetBadgeVisibleItemIds([
      user("u1"),
      assistant("a1", grokLocal),
      assistant("a1b", grokLocal),
      user("u2"),
      assistant("a2", grokLocal),
      assistant("a2b", grokLocal),
    ]);
    expect([...visible]).toEqual(["a1", "a2"]);
  });

  it("re-shows badge when target changes mid-turn", () => {
    const visible = buildTurnTargetBadgeVisibleItemIds([
      user("u1"),
      assistant("a1", claudeA),
      assistant("a2", claudeA),
      assistant("a3", claudeB),
      assistant("a4", claudeB),
    ]);
    expect([...visible]).toEqual(["a1", "a3"]);
  });

  it("ignores non-message rows and assistants without snapshot", () => {
    const visible = buildTurnTargetBadgeVisibleItemIds([
      { id: "tool-1", kind: "tool" },
      assistant("no-snap", null),
      assistant("with-snap", grokLocal),
      assistant("dup", grokLocal),
    ]);
    expect([...visible]).toEqual(["with-snap"]);
  });

  it("resets first-of-turn on user even when tools sit between user and assistant", () => {
    const visible = buildTurnTargetBadgeVisibleItemIds([
      user("u1"),
      assistant("a1", grokLocal),
      user("u2"),
      { id: "tool-2", kind: "tool" },
      assistant("a2", grokLocal),
    ]);
    expect([...visible]).toEqual(["a1", "a2"]);
  });
});
