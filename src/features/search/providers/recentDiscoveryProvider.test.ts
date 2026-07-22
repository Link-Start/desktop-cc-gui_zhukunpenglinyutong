import { describe, expect, it, vi } from "vitest";
import { projectRecentDiscoveryResults } from "./recentDiscoveryProvider";

const action = {
  id: "open-settings",
  title: "设置",
  keywords: ["settings"],
  execute: vi.fn(),
};

describe("projectRecentDiscoveryResults", () => {
  const recentFileGroups = [{
    workspaceId: "w-1",
    workspaceName: "Mossx",
    latestAt: 30,
    files: [{ workspaceId: "w-1", path: "src/App.tsx", touchedAt: 30, source: "opened" as const }],
  }];
  const sessionGroups = [{
    workspaceId: "w-1",
    workspaceName: "Mossx",
    latestAt: 20,
    sessions: [{
      workspaceId: "w-1",
      id: "thread-1",
      title: "Recent work",
      updatedAt: 20,
      engine: "codex" as const,
      isShared: false,
    }],
  }];

  it("projects bounded recent actions, files and sessions", () => {
    const results = projectRecentDiscoveryResults({
      actions: [action],
      recentActions: [{ actionId: action.id, executedAt: 40 }],
      recentFileGroups,
      sessionGroups,
      scope: "global",
      activeWorkspaceId: null,
    });

    expect(results.map((result) => result.kind)).toEqual(["action", "file", "thread"]);
  });

  it("filters workspace content but ignores unknown recent action ids", () => {
    const results = projectRecentDiscoveryResults({
      actions: [action],
      recentActions: [{ actionId: "removed-action", executedAt: 40 }],
      recentFileGroups,
      sessionGroups,
      scope: "active-workspace",
      activeWorkspaceId: "w-2",
    });

    expect(results).toEqual([]);
  });
});
