import { describe, expect, it } from "vitest";

import {
  isGhostClientSessionIndexDeleteError,
  sessionIndexIdsForThreadTombstone,
  shouldSettleDeleteAsSuccess,
} from "./threadDelete";

describe("threadDelete ghost index settlement", () => {
  it("recognizes workspace-unresolved delete errors as ghost index rows", () => {
    expect(
      isGhostClientSessionIndexDeleteError(
        "session does not belong to target workspace",
      ),
    ).toBe(true);
    expect(
      isGhostClientSessionIndexDeleteError(
        "Codex session target could not be resolved safely for this workspace",
      ),
    ).toBe(true);
    expect(
      isGhostClientSessionIndexDeleteError(
        "failed to delete session file",
        "OWNER_WORKSPACE_UNRESOLVED",
      ),
    ).toBe(true);
    expect(
      isGhostClientSessionIndexDeleteError(null, "SESSION_NOT_IN_WORKSPACE_SCOPE"),
    ).toBe(true);
    expect(isGhostClientSessionIndexDeleteError("temporary delete failure")).toBe(
      false,
    );
  });

  it("settles ghost index delete errors as local success", () => {
    expect(
      shouldSettleDeleteAsSuccess("session does not belong to target workspace"),
    ).toBe(true);
    expect(
      shouldSettleDeleteAsSuccess(
        "provider-backed Codex session target could not be resolved safely",
      ),
    ).toBe(true);
    expect(shouldSettleDeleteAsSuccess("temporary delete failure")).toBe(false);
  });

  it("passes the original thread id through so prefixed deletes stay engine-scoped", () => {
    expect(sessionIndexIdsForThreadTombstone("claude:hello-1")).toEqual([
      "claude:hello-1",
    ]);
    expect(
      sessionIndexIdsForThreadTombstone("019d767b-5541-7010-a30d-a454864bccd8"),
    ).toEqual(["019d767b-5541-7010-a30d-a454864bccd8"]);
    expect(sessionIndexIdsForThreadTombstone("   ")).toEqual([]);
  });
});
