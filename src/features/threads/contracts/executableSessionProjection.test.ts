import { describe, expect, it } from "vitest";
import type { RuntimePoolRow } from "../../../types";
import { createExecutableSessionProjectionSelector } from "./executableSessionProjection";

function row(overrides: Partial<RuntimePoolRow> = {}): RuntimePoolRow {
  return {
    workspaceId: "session-1",
    workspaceName: "Workspace",
    workspacePath: "/tmp/workspace",
    engine: "codex",
    state: "streaming",
    lifecycleState: "active",
    pid: 42,
    runtimeGeneration: "generation-1",
    wrapperKind: null,
    resolvedBin: null,
    startedAtMs: 1,
    lastUsedAtMs: 1,
    pinned: false,
    turnLeaseCount: 1,
    streamLeaseCount: 1,
    leaseSources: [],
    activeWorkProtected: true,
    evictCandidate: false,
    evictionReason: null,
    error: null,
    ...overrides,
  };
}

describe("executable session projection selector", () => {
  it("keeps the projection reference stable for streaming-only changes", () => {
    const select = createExecutableSessionProjectionSelector();
    const before = select([row()]);
    const after = select([
      row({ lastUsedAtMs: 2, streamLeaseCount: 2, activeWorkLastRenewedAtMs: 2 }),
    ]);
    expect(after).toBe(before);
  });

  it("changes reference when executable binding changes", () => {
    const select = createExecutableSessionProjectionSelector();
    const before = select([row()]);
    const after = select([row({ pid: 43, runtimeGeneration: "generation-2" })]);
    expect(after).not.toBe(before);
    expect(after[0]?.nativeBinding).toBe("pid:43");
  });
});
