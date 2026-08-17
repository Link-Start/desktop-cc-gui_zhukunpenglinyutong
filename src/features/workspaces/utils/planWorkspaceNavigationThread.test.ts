import { describe, expect, it, vi } from "vitest";

import {
  applyWorkspaceNavigationThreadPlan,
  planWorkspaceNavigationThread,
} from "./planWorkspaceNavigationThread";

describe("planWorkspaceNavigationThread", () => {
  it("restores the last selected thread before any list fallback", () => {
    expect(
      planWorkspaceNavigationThread({
        lastThreadId: "thread-last",
        firstListedThreadId: "thread-first",
        allowFirstListedFallback: true,
      }),
    ).toEqual({ action: "restore", threadId: "thread-last" });
  });

  it("keeps the workspace thread map when sidebar click has no last thread", () => {
    expect(
      planWorkspaceNavigationThread({
        lastThreadId: null,
        firstListedThreadId: "thread-first",
        allowFirstListedFallback: false,
      }),
    ).toEqual({ action: "keep-map" });
  });

  it("falls back to the first listed thread only for cycle navigation", () => {
    expect(
      planWorkspaceNavigationThread({
        lastThreadId: "   ",
        firstListedThreadId: "thread-first",
        allowFirstListedFallback: true,
      }),
    ).toEqual({ action: "fallback", threadId: "thread-first" });
  });

  it("keeps the map when cycle has neither last nor listed thread", () => {
    expect(
      planWorkspaceNavigationThread({
        lastThreadId: null,
        firstListedThreadId: null,
        allowFirstListedFallback: true,
      }),
    ).toEqual({ action: "keep-map" });
  });
});

describe("applyWorkspaceNavigationThreadPlan", () => {
  it("does not wipe the last thread when the plan is keep-map", () => {
    const setActiveThreadId = vi.fn();
    applyWorkspaceNavigationThreadPlan(
      { action: "keep-map" },
      "ws-1",
      setActiveThreadId,
    );
    expect(setActiveThreadId).not.toHaveBeenCalled();
  });

  it("reselects the restored thread so evicted history can resume", () => {
    const setActiveThreadId = vi.fn();
    applyWorkspaceNavigationThreadPlan(
      { action: "restore", threadId: "thread-last" },
      "ws-1",
      setActiveThreadId,
    );
    expect(setActiveThreadId).toHaveBeenCalledWith("thread-last", "ws-1");
  });
});
