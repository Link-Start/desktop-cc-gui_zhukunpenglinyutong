import { beforeEach, describe, expect, it } from "vitest";

import type { SharedV2TurnStateResult } from "../services/sharedSessions";
import {
  consumeSharedSendAdmission,
  dispatchSharedSendEvent,
  getSharedSendActiveAttemptId,
  getSharedSendState,
  getSharedSendStateRevision,
  markSharedSendRestoreFailure,
  releaseSharedSendAdmission,
  resetSharedSendStateStoreForTests,
  restoreSharedSendStateFromTurnState,
  setSharedSendActiveAttempt,
  tryAcquireSharedSend,
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
  it("atomically admits only the first caller while the Shared Session is idle", () => {
    const firstAdmission = tryAcquireSharedSend(WS, THREAD);
    expect(firstAdmission).toEqual({
      acquired: true,
      state: "preparing-context",
      revision: 1,
    });
    expect(tryAcquireSharedSend(WS, THREAD)).toEqual({
      acquired: false,
      state: "preparing-context",
    });
    expect(
      firstAdmission.acquired &&
        consumeSharedSendAdmission(WS, THREAD, firstAdmission.revision),
    ).toBe(true);
    expect(
      firstAdmission.acquired &&
        consumeSharedSendAdmission(WS, THREAD, firstAdmission.revision),
    ).toBe(false);
    expect(getSharedSendState(WS, THREAD).state).toBe("preparing-context");
  });

  it("releases only the exact unconsumed admission before handoff", () => {
    const admission = tryAcquireSharedSend(WS, THREAD);
    expect(admission.acquired).toBe(true);
    if (!admission.acquired) {
      throw new Error("expected admission");
    }

    expect(releaseSharedSendAdmission(WS, THREAD, admission.revision + 1)).toBe(
      false,
    );
    expect(getSharedSendState(WS, THREAD).state).toBe("preparing-context");
    expect(releaseSharedSendAdmission(WS, THREAD, admission.revision)).toBe(true);
    expect(getSharedSendState(WS, THREAD).state).toBe("idle");
    expect(consumeSharedSendAdmission(WS, THREAD, admission.revision)).toBe(false);
  });

  it("drives the happy path and resets to idle", () => {
    setSharedSendActiveAttempt(WS, THREAD, "attempt-1");
    dispatchSharedSendEvent(WS, THREAD, { type: "send" });
    expect(getSharedSendState(WS, THREAD).state).toBe("preparing-context");
    dispatchSharedSendEvent(WS, THREAD, { type: "packagePrepared" });
    dispatchSharedSendEvent(WS, THREAD, { type: "runtimeAck" });
    expect(getSharedSendState(WS, THREAD).state).toBe("running");
    dispatchSharedSendEvent(WS, THREAD, { type: "runSettled" });
    dispatchSharedSendEvent(WS, THREAD, { type: "canonicalCommitted" });
    expect(getSharedSendState(WS, THREAD).state).toBe("idle");
    expect(getSharedSendActiveAttemptId(WS, THREAD)).toBeNull();
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

  it("accepted in-flight attempt with live Rust owner → running", () => {
    restoreSharedSendStateFromTurnState(
      WS,
      THREAD,
      turnState({
        inFlightAttempts: [
          {
            attemptId: "a1",
            logicalTurnId: "t1",
            accepted: true,
            runtimeObserverOwned: true,
          },
        ],
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
    expect(getSharedSendActiveAttemptId(WS, THREAD)).toBe("a1");
  });

  it("accepted attempt after process restart has no owner → recovery-required", () => {
    restoreSharedSendStateFromTurnState(
      WS,
      THREAD,
      turnState({
        inFlightAttempts: [
          {
            attemptId: "a1",
            logicalTurnId: "t1",
            accepted: true,
            runtimeObserverOwned: false,
          },
        ],
      }),
    );

    expect(getSharedSendState(WS, THREAD).state).toBe("recovery-required");
    expect(getSharedSendActiveAttemptId(WS, THREAD)).toBe("a1");
  });

  it("creating 只证明 Tx1 已落账，不能当作 runtime ACK", () => {
    restoreSharedSendStateFromTurnState(
      WS,
      THREAD,
      turnState({
        inFlightAttempts: [
          { attemptId: "a1", logicalTurnId: "t1", accepted: false },
        ],
        bindings: [
          {
            bindingKey: "claude:default",
            provisioningState: "creating",
            availability: "available",
          },
        ],
      }),
    );
    expect(getSharedSendState(WS, THREAD).state).toBe("recovery-required");
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
    setSharedSendActiveAttempt(WS, THREAD, "stale-attempt");
    restoreSharedSendStateFromTurnState(WS, THREAD, turnState());
    expect(getSharedSendState(WS, THREAD).state).toBe("idle");
    expect(getSharedSendActiveAttemptId(WS, THREAD)).toBeNull();
  });

  it("multiple in-flight attempts leave control owner unresolved", () => {
    restoreSharedSendStateFromTurnState(
      WS,
      THREAD,
      turnState({
        inFlightAttempts: [
          { attemptId: "a1", accepted: true, runtimeObserverOwned: true },
          { attemptId: "a2", accepted: true, runtimeObserverOwned: true },
        ],
      }),
    );

    expect(getSharedSendState(WS, THREAD).state).toBe("recovery-required");
    expect(getSharedSendActiveAttemptId(WS, THREAD)).toBeNull();
  });

  it("rejects stale restore evidence after a complete send cycle", () => {
    const restoreRevision = getSharedSendStateRevision(WS, THREAD);

    dispatchSharedSendEvent(WS, THREAD, { type: "send" });
    dispatchSharedSendEvent(WS, THREAD, { type: "packagePrepared" });
    dispatchSharedSendEvent(WS, THREAD, { type: "runtimeAck" });
    dispatchSharedSendEvent(WS, THREAD, { type: "runSettled" });
    dispatchSharedSendEvent(WS, THREAD, { type: "canonicalCommitted" });
    expect(getSharedSendState(WS, THREAD).state).toBe("idle");

    const restored = restoreSharedSendStateFromTurnState(
      WS,
      THREAD,
      turnState({
        inFlightAttempts: [
          { attemptId: "stale-a1", logicalTurnId: "stale-t1", accepted: true },
        ],
      }),
      restoreRevision,
    );

    expect(restored).toBe(false);
    expect(getSharedSendState(WS, THREAD).state).toBe("idle");
  });

  it("durable restore RPC failure fails closed unless state already advanced", () => {
    const revision = getSharedSendStateRevision(WS, THREAD);
    expect(markSharedSendRestoreFailure(WS, THREAD, "sqlite unavailable", revision)).toBe(
      true,
    );
    expect(getSharedSendState(WS, THREAD)).toMatchObject({
      state: "recovery-required",
      detail: "sqlite unavailable",
    });

    resetSharedSendStateStoreForTests();
    const staleRevision = getSharedSendStateRevision(WS, THREAD);
    dispatchSharedSendEvent(WS, THREAD, { type: "send" });
    expect(
      markSharedSendRestoreFailure(WS, THREAD, "late failure", staleRevision),
    ).toBe(false);
    expect(getSharedSendState(WS, THREAD).state).toBe("preparing-context");
  });
});
