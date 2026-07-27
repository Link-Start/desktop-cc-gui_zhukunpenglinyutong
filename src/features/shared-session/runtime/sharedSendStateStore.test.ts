import { beforeEach, describe, expect, it } from "vitest";

import type { SharedV2TurnStateResult } from "../services/sharedSessions";
import {
  dispatchSharedSendEvent,
  getSharedSendState,
  resetSharedSendStateStoreForTests,
  restoreSharedSendStateFromTurnState,
} from "./sharedSendStateStore";

const WS = "ws-1";
const THREAD = "shared-thread-1";

function turnState(
  overrides: Partial<SharedV2TurnStateResult> = {},
): SharedV2TurnStateResult {
  return {
    status: "ok",
    inFlightAttempts: [],
    bindings: [],
    ...overrides,
  };
}

beforeEach(() => {
  resetSharedSendStateStoreForTests();
});

describe("dispatchSharedSendEvent", () => {
  it("drives the happy path and resets to idle", () => {
    dispatchSharedSendEvent(WS, THREAD, { type: "send" });
    expect(getSharedSendState(WS, THREAD).state).toBe("preparing-context");
    dispatchSharedSendEvent(WS, THREAD, { type: "packagePrepared" });
    dispatchSharedSendEvent(WS, THREAD, { type: "runtimeAck" });
    expect(getSharedSendState(WS, THREAD).state).toBe("running");
    dispatchSharedSendEvent(WS, THREAD, { type: "runSettled" });
    dispatchSharedSendEvent(WS, THREAD, { type: "canonicalCommitted" });
    expect(getSharedSendState(WS, THREAD).state).toBe("idle");
  });

  it("ignores illegal transitions (idempotent)", () => {
    dispatchSharedSendEvent(WS, THREAD, { type: "runtimeAck" });
    expect(getSharedSendState(WS, THREAD).state).toBe("idle");
  });

  it("records degradedInfo in degraded-context and clears it on exit", () => {
    dispatchSharedSendEvent(WS, THREAD, { type: "send" });
    dispatchSharedSendEvent(WS, THREAD, { type: "lossyProjection" }, {
      degradedInfo: { reason: "omissions: 2 files" },
    });
    expect(getSharedSendState(WS, THREAD)).toEqual({
      state: "degraded-context",
      degradedInfo: { reason: "omissions: 2 files" },
      detail: null,
    });
    dispatchSharedSendEvent(WS, THREAD, { type: "degradedConfirmed" });
    expect(getSharedSendState(WS, THREAD).degradedInfo).toBeNull();
  });

  it("keeps target-unavailable detail until repaired", () => {
    dispatchSharedSendEvent(WS, THREAD, { type: "send" });
    dispatchSharedSendEvent(WS, THREAD, { type: "targetUnavailable" }, {
      detail: "provider removed",
    });
    expect(getSharedSendState(WS, THREAD)).toEqual({
      state: "target-unavailable",
      degradedInfo: null,
      detail: "provider removed",
    });
    dispatchSharedSendEvent(WS, THREAD, { type: "targetRepaired" });
    expect(getSharedSendState(WS, THREAD).detail).toBeNull();
  });

  it("§14.5.6: ambiguous 时整个 Shared Session 不接受下一 Turn", () => {
    dispatchSharedSendEvent(WS, THREAD, { type: "send" });
    dispatchSharedSendEvent(WS, THREAD, { type: "packagePrepared" });
    dispatchSharedSendEvent(WS, THREAD, { type: "ackAmbiguous" });
    expect(getSharedSendState(WS, THREAD).state).toBe("recovery-required");
    // 即使用户再次发送，状态机不放行。
    dispatchSharedSendEvent(WS, THREAD, { type: "send" });
    expect(getSharedSendState(WS, THREAD).state).toBe("recovery-required");
  });

  it("isolates state per workspace::thread key", () => {
    dispatchSharedSendEvent(WS, THREAD, { type: "send" });
    expect(getSharedSendState(WS, "other").state).toBe("idle");
    expect(getSharedSendState("other", THREAD).state).toBe("idle");
  });
});

describe("restoreSharedSendStateFromTurnState (B.6.5)", () => {
  it("recovery binding → recovery-required（重启不落 idle）", () => {
    restoreSharedSendStateFromTurnState(
      WS,
      THREAD,
      turnState({
        bindings: [
          {
            bindingKey: "claude:default",
            provisioningState: "recovery-required",
            availability: "available",
          },
        ],
      }),
    );
    expect(getSharedSendState(WS, THREAD).state).toBe("recovery-required");
  });

  it("in-flight attempt + creating binding → running", () => {
    restoreSharedSendStateFromTurnState(
      WS,
      THREAD,
      turnState({
        inFlightAttempts: [{ attemptId: "a1", logicalTurnId: "t1" }],
        bindings: [
          {
            bindingKey: "claude:default",
            provisioningState: "creating",
            availability: "available",
          },
        ],
      }),
    );
    expect(getSharedSendState(WS, THREAD).state).toBe("running");
  });

  it("in-flight attempt without ACK evidence → recovery-required（fail closed）", () => {
    restoreSharedSendStateFromTurnState(
      WS,
      THREAD,
      turnState({
        inFlightAttempts: [{ attemptId: "a1", logicalTurnId: "t1" }],
        bindings: [
          {
            bindingKey: "claude:default",
            provisioningState: "ready",
            availability: "available",
          },
        ],
      }),
    );
    expect(getSharedSendState(WS, THREAD).state).toBe("recovery-required");
  });

  it("no durable evidence → idle", () => {
    restoreSharedSendStateFromTurnState(WS, THREAD, turnState());
    expect(getSharedSendState(WS, THREAD).state).toBe("idle");
  });
});
