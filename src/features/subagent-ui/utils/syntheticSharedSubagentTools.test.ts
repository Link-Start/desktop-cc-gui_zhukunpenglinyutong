import { describe, expect, it } from "vitest";
import {
  buildSyntheticSpawnToolsFromChildren,
  injectSyntheticSubagentToolsIfNeeded,
  shouldInjectChildSubagentSynthetic,
} from "./syntheticSharedSubagentTools";
import { isSubagentTool } from "./isSubagentTool";
import {
  buildSubagentCardsFromToolItems,
  dedupeSubagentSquadCards,
} from "./subagentViewModel";
import type { ConversationItem } from "../../../types";

describe("syntheticSharedSubagentTools", () => {
  it("builds spawn tools that are recognized as subagent tools", () => {
    const tools = buildSyntheticSpawnToolsFromChildren([
      {
        id: "grok:019fc1ed-c621-7f10-a129-44722af6d9c5",
        name: "你是子代理 #1",
        updatedAt: 1,
        engineSource: "grok",
        parentThreadId: "shared:parent",
      },
      {
        id: "grok:019fc1ed-c621-7f10-a129-448771624821",
        name: "你是子代理 #2",
        updatedAt: 1,
        engineSource: "grok",
        parentThreadId: "shared:parent",
      },
    ]);
    expect(tools).toHaveLength(2);
    expect(tools.every((tool) => isSubagentTool(tool))).toBe(true);
    const cards = buildSubagentCardsFromToolItems(tools, {
      parentThreadId: "shared:parent",
    });
    expect(cards).toHaveLength(2);
    expect(cards[0]?.sessionThreadId).toBe(
      "grok:019fc1ed-c621-7f10-a129-44722af6d9c5",
    );
  });

  it("injects after last user message", () => {
    const items = [
      { id: "u1", kind: "message" as const, role: "user" as const, text: "hi" },
      {
        id: "a1",
        kind: "message" as const,
        role: "assistant" as const,
        text: "ok",
      },
    ];
    const synthetic = buildSyntheticSpawnToolsFromChildren([
      {
        id: "grok:child",
        name: "child",
        updatedAt: 1,
        engineSource: "grok",
      },
    ]);
    const next = injectSyntheticSubagentToolsIfNeeded(items, synthetic);
    expect(next.map((item) => item.id)).toEqual([
      "u1",
      "synthetic-shared-subagent:grok:child",
      "a1",
    ]);
  });

  it("uses codex id prefix when requested", () => {
    const tools = buildSyntheticSpawnToolsFromChildren(
      [{ id: "agent-7", name: "Banach", updatedAt: 1 }],
      { idPrefix: "codex" },
    );
    expect(tools[0]?.id).toBe("synthetic-codex-subagent:agent-7");
  });
});

describe("shouldInjectChildSubagentSynthetic", () => {
  const waitOnly: ConversationItem[] = [
    {
      id: "w1",
      kind: "tool",
      toolType: "collabToolCall",
      title: "Collab: wait",
      detail: "",
      status: "running",
    },
  ];

  it("injects for codex native wait-only with children", () => {
    expect(
      shouldInjectChildSubagentSynthetic({
        ownThreadId: "parent-thread",
        canvasThreadId: "parent-thread",
        activeEngine: "codex",
        items: waitOnly,
        childCount: 3,
      }),
    ).toBe(true);
  });

  it("does not inject when collab spawn already has receivers", () => {
    expect(
      shouldInjectChildSubagentSynthetic({
        ownThreadId: "parent-thread",
        canvasThreadId: "parent-thread",
        activeEngine: "codex",
        items: [
          {
            id: "s1",
            kind: "tool",
            toolType: "collabToolCall",
            title: "Collab: spawn_agent",
            detail: "",
            status: "completed",
            receiverThreadIds: ["agent-7"],
          },
        ],
        childCount: 3,
      }),
    ).toBe(false);
  });

  it("still injects when collab spawn has no receivers yet (live half-state)", () => {
    expect(
      shouldInjectChildSubagentSynthetic({
        ownThreadId: "parent-thread",
        canvasThreadId: "parent-thread",
        activeEngine: "codex",
        items: [
          {
            id: "s1",
            kind: "tool",
            toolType: "collabToolCall",
            title: "Collab: spawn_agent",
            detail: JSON.stringify({ task_name: "Audit" }),
            status: "running",
          },
        ],
        childCount: 3,
      }),
    ).toBe(true);
  });

  it("does not inject for claude/grok native children without tools", () => {
    expect(
      shouldInjectChildSubagentSynthetic({
        ownThreadId: "claude:session",
        canvasThreadId: "claude:session",
        activeEngine: "claude",
        items: waitOnly,
        childCount: 2,
      }),
    ).toBe(false);
    expect(
      shouldInjectChildSubagentSynthetic({
        ownThreadId: "grok:session",
        canvasThreadId: "grok:session",
        activeEngine: "grok",
        items: [],
        childCount: 2,
      }),
    ).toBe(false);
  });

  it("still injects for shared parent (any engine) without subagent tools", () => {
    expect(
      shouldInjectChildSubagentSynthetic({
        ownThreadId: "shared:parent",
        canvasThreadId: "shared:parent",
        activeEngine: "grok",
        items: [],
        childCount: 2,
      }),
    ).toBe(true);
  });

  it("never injects on nested detail canvas (own !== canvas)", () => {
    expect(
      shouldInjectChildSubagentSynthetic({
        ownThreadId: "agent-7",
        canvasThreadId: "parent-thread",
        activeEngine: "codex",
        items: waitOnly,
        childCount: 3,
      }),
    ).toBe(false);
  });
});

describe("synthetic vs real spawn dedupe", () => {
  it("prefers real collab card over synthetic with same agentId", () => {
    const synthetic = buildSyntheticSpawnToolsFromChildren(
      [{ id: "agent-7", name: "Banach", updatedAt: 1 }],
      { idPrefix: "codex" },
    );
    const real: Extract<ConversationItem, { kind: "tool" }> = {
      id: "spawn-1",
      kind: "tool",
      toolType: "collabToolCall",
      title: "Collab: spawn_agent",
      status: "completed",
      receiverThreadIds: ["agent-7"],
      detail: JSON.stringify({ task_name: "Audit docs" }),
      output: "done",
    };
    const cards = buildSubagentCardsFromToolItems(
      [...synthetic, real].filter(
        (item): item is Extract<ConversationItem, { kind: "tool" }> =>
          item.kind === "tool",
      ),
      { parentThreadId: "parent-thread" },
    );
    const deduped = dedupeSubagentSquadCards(cards);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.id).not.toContain("synthetic-");
    expect(deduped[0]?.agentId).toBe("agent-7");
  });
});
