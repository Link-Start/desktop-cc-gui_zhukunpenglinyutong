import { describe, expect, it } from "vitest";
import {
  HISTORY_LOADING_SPINE_NODE_IDS,
  resolveHistoryLoadingSpineNodes,
} from "./historyLoadingSpine";

describe("resolveHistoryLoadingSpineNodes", () => {
  it("returns no nodes for Native indeterminate restore", () => {
    expect(resolveHistoryLoadingSpineNodes(null)).toEqual([]);
  });

  it("marks the active Shared phase as current and earlier ones as done", () => {
    expect(resolveHistoryLoadingSpineNodes("projection")).toEqual([
      { id: "prepare", state: "done" },
      { id: "session", state: "done" },
      { id: "projection", state: "current" },
      { id: "merge", state: "pending" },
    ]);
  });

  it("marks the first Shared phase as current", () => {
    expect(resolveHistoryLoadingSpineNodes("prepare")).toEqual([
      { id: "prepare", state: "current" },
      { id: "session", state: "pending" },
      { id: "projection", state: "pending" },
      { id: "merge", state: "pending" },
    ]);
  });

  it("marks every spine node done when finalize lands", () => {
    expect(resolveHistoryLoadingSpineNodes("finalize")).toEqual(
      HISTORY_LOADING_SPINE_NODE_IDS.map((id) => ({ id, state: "done" })),
    );
  });
});
