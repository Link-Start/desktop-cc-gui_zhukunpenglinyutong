import { afterEach, describe, expect, it } from "vitest";

import {
  peekWorkspaceLastThreadId,
  publishWorkspaceLastThreadMap,
  resetWorkspaceLastThreadMapForTests,
} from "./workspaceLastThreadMap";

describe("workspaceLastThreadMap", () => {
  afterEach(() => {
    resetWorkspaceLastThreadMapForTests();
  });

  it("returns the last published thread for a workspace", () => {
    publishWorkspaceLastThreadMap({
      "ws-a": "thread-a",
      "ws-b": "thread-b",
    });

    expect(peekWorkspaceLastThreadId("ws-a")).toBe("thread-a");
    expect(peekWorkspaceLastThreadId("ws-b")).toBe("thread-b");
  });

  it("snapshots the published map so later mutation cannot leak", () => {
    const liveMap: Record<string, string | null> = {
      "ws-a": "thread-a",
    };
    publishWorkspaceLastThreadMap(liveMap);
    liveMap["ws-a"] = "thread-mutated";

    expect(peekWorkspaceLastThreadId("ws-a")).toBe("thread-a");
  });

  it("treats blank and missing entries as no last thread", () => {
    publishWorkspaceLastThreadMap({
      "ws-empty": "   ",
      "ws-null": null,
    });

    expect(peekWorkspaceLastThreadId("ws-empty")).toBeNull();
    expect(peekWorkspaceLastThreadId("ws-null")).toBeNull();
    expect(peekWorkspaceLastThreadId("ws-missing")).toBeNull();
  });
});
