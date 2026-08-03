import { describe, expect, it } from "vitest";
import type { ThreadSummary } from "../../types";
import { projectQuickSwitcherSessionGroups } from "./sessionProjection";

describe("projectQuickSwitcherSessionGroups", () => {
  it("takes the global newest 30 before grouping by workspace", () => {
    const threads: ThreadSummary[] = Array.from({ length: 32 }, (_, index) => ({
      id: `thread-${index}`,
      name: `Session ${index}`,
      updatedAt: index,
      selectedEngine: index === 31 ? "claude" : "codex",
    }));

    const result = projectQuickSwitcherSessionGroups(
      [
        { id: "workspace-a", name: "Alpha" },
        { id: "workspace-b", name: "Beta" },
      ],
      {
        "workspace-a": threads,
        "workspace-b": [
          { id: "beta-new", name: "Beta newest", updatedAt: 100 },
        ],
      },
    );

    expect(result.flatMap((group) => group.sessions)).toHaveLength(30);
    expect(result[0]).toMatchObject({
      workspaceId: "workspace-b",
      workspaceName: "Beta",
      latestAt: 100,
    });
    expect(result[0]?.sessions[0]?.id).toBe("beta-new");
    expect(result[1]?.sessions.at(-1)?.id).toBe("thread-3");
  });

  it("marks shared: sessions as shared even when threadKind projection is lost", () => {
    const result = projectQuickSwitcherSessionGroups(
      [{ id: "workspace-a", name: "Alpha" }],
      {
        "workspace-a": [
          {
            id: "shared:lost-kind",
            name: "Shared CLI",
            updatedAt: 10,
            engineSource: "claude",
            selectedEngine: "claude",
            // kind 投影丢失：缺省或 native 都不应改掉 Shared 图标语义
            threadKind: "native",
          },
          {
            id: "claude:native-1",
            name: "Native Claude",
            updatedAt: 9,
            engineSource: "claude",
            threadKind: "native",
          },
        ],
      },
    );

    const sessions = result[0]?.sessions ?? [];
    expect(sessions.find((s) => s.id === "shared:lost-kind")?.isShared).toBe(
      true,
    );
    expect(sessions.find((s) => s.id === "claude:native-1")?.isShared).toBe(
      false,
    );
  });
});
