import { describe, expect, it } from "vitest";
import {
  buildSyntheticSpawnToolsFromChildren,
  injectSyntheticSubagentToolsIfNeeded,
} from "./syntheticSharedSubagentTools";
import { isSubagentTool } from "./isSubagentTool";
import { buildSubagentCardsFromToolItems } from "./subagentViewModel";

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
});
