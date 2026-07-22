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
});
