// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  awaitTerminal: vi.fn(),
  registerNativeBinding: vi.fn(),
}));

vi.mock("../services/sharedSessions", () => ({
  sharedSessionV2AwaitTurnTerminal: mocks.awaitTerminal,
}));

vi.mock("./sharedSessionBridge", () => ({
  registerSharedSessionNativeBinding: mocks.registerNativeBinding,
}));

import type {
  SharedV2ActiveAttemptRecovery,
  SharedV2AwaitTurnTerminalResult,
} from "../services/sharedSessions";
import {
  beginTurn,
  getSharedTargetState,
  resetSharedTargetStoreForTests,
} from "../target/targetStore";
import {
  dispatchSharedSendEvent,
  getSharedSendActiveAttemptId,
  getSharedSendState,
  resetSharedSendStateStoreForTests,
  setSharedSendActiveAttempt,
} from "./sharedSendStateStore";
import {
  reattachSharedSessionAttempt,
  resetSharedSessionAttemptReattachmentsForTests,
  subscribeSharedSessionAttemptSettlements,
} from "./reattachSharedSessionAttempt";

const WORKSPACE_ID = "ws-reattach";
const THREAD_ID = "shared:reattach";
const ACTIVE_RECOVERY: SharedV2ActiveAttemptRecovery = {
  status: "active",
  attemptId: "attempt-active",
  bindingKey: "codex:provider-a",
  nativeThreadId: "native-thread-1",
  runtimeTurnId: "runtime-turn-1",
  executionTargetSnapshot: {
    engine: "codex",
    providerProfileId: "provider-a",
    modelCatalogEntryId: "catalog-gpt-5",
    model: "gpt-5",
    reasoning: { effort: "high" },
    providerProfileNameSnapshot: "Provider A",
    providerProfileSource: "managed",
    runtimeCapabilityFingerprint: "runtime-v1",
  },
};
const COMMITTED: SharedV2AwaitTurnTerminalResult = {
  status: "committed",
  duplicate: false,
  sequence: 9,
  bindingKey: "codex:provider-a",
  terminal: {
    type: "run.settled",
    outcome: "completed",
    recoveryReason: null,
  },
};

function enterRecoveryRequired(): void {
  dispatchSharedSendEvent(WORKSPACE_ID, THREAD_ID, { type: "send" });
  dispatchSharedSendEvent(WORKSPACE_ID, THREAD_ID, {
    type: "packagePrepared",
  });
  dispatchSharedSendEvent(WORKSPACE_ID, THREAD_ID, {
    type: "ackAmbiguous",
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  mocks.awaitTerminal.mockReset();
  mocks.registerNativeBinding.mockReset();
  mocks.registerNativeBinding.mockReturnValue(true);
  resetSharedSendStateStoreForTests();
  resetSharedTargetStoreForTests();
  resetSharedSessionAttemptReattachmentsForTests();
  enterRecoveryRequired();
});

describe("reattachSharedSessionAttempt", () => {
  it("按 exact Attempt 去重，并恢复 Runtime binding、processing owner 与 frozen Target", async () => {
    const terminal = deferred<SharedV2AwaitTurnTerminalResult>();
    const settlementListener = vi.fn();
    subscribeSharedSessionAttemptSettlements(settlementListener);
    mocks.awaitTerminal.mockReturnValue(terminal.promise);

    const first = reattachSharedSessionAttempt(
      WORKSPACE_ID,
      THREAD_ID,
      ACTIVE_RECOVERY,
    );
    const second = reattachSharedSessionAttempt(
      WORKSPACE_ID,
      THREAD_ID,
      ACTIVE_RECOVERY,
    );

    expect(second).toBe(first);
    expect(mocks.awaitTerminal).toHaveBeenCalledTimes(1);
    expect(mocks.awaitTerminal).toHaveBeenCalledWith(
      WORKSPACE_ID,
      THREAD_ID,
      "attempt-active",
    );
    expect(mocks.registerNativeBinding).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      sharedThreadId: THREAD_ID,
      nativeThreadId: "native-thread-1",
      engine: "codex",
      providerProfileId: "provider-a",
      attemptId: "attempt-active",
      executionTargetSnapshot: expect.objectContaining({
        engine: "codex",
        model: "gpt-5",
      }),
    });
    expect(getSharedSendState(WORKSPACE_ID, THREAD_ID).state).toBe("running");
    expect(getSharedSendActiveAttemptId(WORKSPACE_ID, THREAD_ID)).toBe(
      "attempt-active",
    );
    expect(
      getSharedTargetState(WORKSPACE_ID, THREAD_ID).activeTurnTarget,
    ).toMatchObject({
      engine: "codex",
      providerProfileId: "provider-a",
      model: "gpt-5",
    });

    terminal.resolve(COMMITTED);
    await expect(first).resolves.toBe(COMMITTED);
    expect(getSharedSendState(WORKSPACE_ID, THREAD_ID).state).toBe("idle");
    expect(getSharedSendActiveAttemptId(WORKSPACE_ID, THREAD_ID)).toBeNull();
    expect(
      getSharedTargetState(WORKSPACE_ID, THREAD_ID).activeTurnTarget,
    ).toBeNull();
    expect(settlementListener).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      threadId: THREAD_ID,
      attemptId: "attempt-active",
      runtimeTurnId: "runtime-turn-1",
      commit: COMMITTED,
    });
  });

  it("observer 再次断开时回到 recovery，并保留 exact owner 与 Target", async () => {
    const observerError = new Error("ipc detached");
    mocks.awaitTerminal.mockRejectedValue(observerError);

    const observer = reattachSharedSessionAttempt(
      WORKSPACE_ID,
      THREAD_ID,
      ACTIVE_RECOVERY,
    );

    await expect(observer).rejects.toBe(observerError);
    expect(getSharedSendState(WORKSPACE_ID, THREAD_ID).state).toBe(
      "recovery-required",
    );
    expect(getSharedSendActiveAttemptId(WORKSPACE_ID, THREAD_ID)).toBe(
      "attempt-active",
    );
    expect(
      getSharedTargetState(WORKSPACE_ID, THREAD_ID).activeTurnTarget,
    ).toMatchObject({ engine: "codex", model: "gpt-5" });
  });

  it("旧 observer 晚到 terminal 时不清理新 Attempt owner/Target", async () => {
    const terminal = deferred<SharedV2AwaitTurnTerminalResult>();
    mocks.awaitTerminal.mockReturnValue(terminal.promise);
    const staleObserver = reattachSharedSessionAttempt(
      WORKSPACE_ID,
      THREAD_ID,
      ACTIVE_RECOVERY,
    );
    const currentTarget = Object.freeze({
      ...ACTIVE_RECOVERY.executionTargetSnapshot,
      modelCatalogEntryId: "catalog-current",
      model: "gpt-5-current",
    });
    setSharedSendActiveAttempt(
      WORKSPACE_ID,
      THREAD_ID,
      "attempt-current",
    );
    beginTurn(
      WORKSPACE_ID,
      THREAD_ID,
      currentTarget,
      "attempt-current",
    );

    terminal.resolve(COMMITTED);
    await staleObserver;

    expect(
      getSharedSendActiveAttemptId(WORKSPACE_ID, THREAD_ID),
    ).toBe("attempt-current");
    expect(
      getSharedTargetState(WORKSPACE_ID, THREAD_ID).activeTurnTarget,
    ).toBe(currentTarget);
    expect(getSharedSendState(WORKSPACE_ID, THREAD_ID).state).toBe("running");
  });

  it("native session 缺失终态保留 recovery 锁，但释放已结束 Attempt owner", async () => {
    mocks.awaitTerminal.mockResolvedValue({
      ...COMMITTED,
      terminal: {
        ...COMMITTED.terminal,
        outcome: "failed",
        recoveryReason: "native-session-not-found",
      },
    });

    await expect(
      reattachSharedSessionAttempt(
        WORKSPACE_ID,
        THREAD_ID,
        ACTIVE_RECOVERY,
      ),
    ).resolves.toMatchObject({
      terminal: { recoveryReason: "native-session-not-found" },
    });

    expect(getSharedSendState(WORKSPACE_ID, THREAD_ID).state).toBe(
      "recovery-required",
    );
    expect(getSharedSendActiveAttemptId(WORKSPACE_ID, THREAD_ID)).toBeNull();
    expect(
      getSharedTargetState(WORKSPACE_ID, THREAD_ID).activeTurnTarget,
    ).toBeNull();
  });

  it("缺少 durable owner identity 时 fail closed，不启动 observer", () => {
    expect(() =>
      reattachSharedSessionAttempt(WORKSPACE_ID, THREAD_ID, {
        ...ACTIVE_RECOVERY,
        runtimeTurnId: "",
      }),
    ).toThrow("shared-active-recovery-invalid: runtimeTurnId is required");
    expect(mocks.awaitTerminal).not.toHaveBeenCalled();
    expect(getSharedSendState(WORKSPACE_ID, THREAD_ID).state).toBe(
      "recovery-required",
    );
  });
});
