// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  turnState: vi.fn(),
  recoverAttempt: vi.fn(),
  awaitTerminal: vi.fn(),
  registerNativeBinding: vi.fn(),
}));

vi.mock("../services/sharedSessions", () => ({
  sharedSessionV2TurnState: mocks.turnState,
  sharedSessionV2RecoverAttempt: mocks.recoverAttempt,
  sharedSessionV2AwaitTurnTerminal: mocks.awaitTerminal,
}));

vi.mock("./sharedSessionBridge", () => ({
  registerSharedSessionNativeBinding: mocks.registerNativeBinding,
}));

vi.mock("./sharedV2SendFlag", () => ({
  isSharedV2SendEnabled: () => true,
}));

import type {
  SharedV2AwaitTurnTerminalResult,
  SharedV2TurnStateResult,
} from "../services/sharedSessions";
import {
  getSharedTargetState,
  resetSharedTargetStoreForTests,
} from "../target/targetStore";
import {
  getSharedSendActiveAttemptId,
  getSharedSendState,
  resetSharedSendStateStoreForTests,
} from "./sharedSendStateStore";
import { resetSharedSessionAttemptReattachmentsForTests } from "./reattachSharedSessionAttempt";
import { useSharedSendStateRestore } from "./useSharedSendStateRestore";

const WORKSPACE_ID = "ws-restore";
const THREAD_ID = "shared:restore";
const ACTIVE_TURN_STATE: SharedV2TurnStateResult = {
  status: "ok",
  inFlightAttempts: [
    {
      attemptId: "attempt-restored",
      logicalTurnId: "logical-restored",
      bindingKey: "codex:provider-a",
      accepted: true,
      runtimeObserverOwned: true,
    },
  ],
  bindings: [
    {
      bindingKey: "codex:provider-a",
      provisioningState: "creating",
      availability: "available",
    },
  ],
};
const COMMITTED: SharedV2AwaitTurnTerminalResult = {
  status: "committed",
  duplicate: false,
  sequence: 23,
  bindingKey: "codex:provider-a",
  terminal: {
    type: "run.settled",
    outcome: "completed",
    recoveryReason: null,
  },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

beforeEach(() => {
  mocks.turnState.mockReset();
  mocks.recoverAttempt.mockReset();
  mocks.awaitTerminal.mockReset();
  mocks.registerNativeBinding.mockReset();
  mocks.registerNativeBinding.mockReturnValue(true);
  resetSharedSendStateStoreForTests();
  resetSharedTargetStoreForTests();
  resetSharedSessionAttemptReattachmentsForTests();
});

describe("useSharedSendStateRestore", () => {
  it("恢复 live accepted owner 时先重挂 terminal observer，再保持 running", async () => {
    const terminal = deferred<SharedV2AwaitTurnTerminalResult>();
    const recovery = deferred<{
      status: "active";
      attemptId: string;
      bindingKey: string;
      nativeThreadId: string;
      runtimeTurnId: string;
      executionTargetSnapshot: {
        engine: "codex";
        providerProfileId: string;
        modelCatalogEntryId: string;
        model: string;
        reasoning: { effort: string };
        providerProfileNameSnapshot: string;
        providerProfileSource: "managed";
        runtimeCapabilityFingerprint: null;
      };
    }>();
    mocks.turnState.mockResolvedValue(ACTIVE_TURN_STATE);
    mocks.recoverAttempt.mockReturnValue(recovery.promise);
    mocks.awaitTerminal.mockReturnValue(terminal.promise);

    renderHook(() =>
      useSharedSendStateRestore(WORKSPACE_ID, THREAD_ID, true),
    );

    await waitFor(() => {
      expect(getSharedSendState(WORKSPACE_ID, THREAD_ID).state).toBe(
        "recovery-required",
      );
    });
    expect(mocks.awaitTerminal).not.toHaveBeenCalled();

    await act(async () => {
      recovery.resolve({
        status: "active",
        attemptId: "attempt-restored",
        bindingKey: "codex:provider-a",
        nativeThreadId: "native-restored",
        runtimeTurnId: "runtime-restored",
        executionTargetSnapshot: {
          engine: "codex",
          providerProfileId: "provider-a",
          modelCatalogEntryId: "settings-gpt-5",
          model: "gpt-5",
          reasoning: { effort: "high" },
          providerProfileNameSnapshot: "Provider A",
          providerProfileSource: "managed",
          runtimeCapabilityFingerprint: null,
        },
      });
      await recovery.promise;
    });

    await waitFor(() => {
      expect(getSharedSendState(WORKSPACE_ID, THREAD_ID).state).toBe(
        "running",
      );
    });
    expect(mocks.recoverAttempt).toHaveBeenCalledWith(
      WORKSPACE_ID,
      THREAD_ID,
      "attempt-restored",
    );
    expect(mocks.awaitTerminal).toHaveBeenCalledWith(
      WORKSPACE_ID,
      THREAD_ID,
      "attempt-restored",
    );
    expect(getSharedSendActiveAttemptId(WORKSPACE_ID, THREAD_ID)).toBe(
      "attempt-restored",
    );
    expect(
      getSharedTargetState(WORKSPACE_ID, THREAD_ID).activeTurnTarget,
    ).toMatchObject({ engine: "codex", model: "gpt-5" });

    terminal.resolve(COMMITTED);
    await waitFor(() => {
      expect(getSharedSendState(WORKSPACE_ID, THREAD_ID).state).toBe("idle");
    });
  });

  it("restore evidence 过期且 recover 已 terminal 时复查 durable state", async () => {
    mocks.turnState
      .mockResolvedValueOnce(ACTIVE_TURN_STATE)
      .mockResolvedValueOnce({
        status: "ok",
        inFlightAttempts: [],
        bindings: [],
      });
    mocks.recoverAttempt.mockResolvedValue({
      status: "terminal-committed",
      attemptId: "attempt-restored",
      bindingKey: "codex:provider-a",
      sequence: 23,
    });

    renderHook(() =>
      useSharedSendStateRestore(WORKSPACE_ID, THREAD_ID, true),
    );

    await waitFor(() => {
      expect(mocks.turnState).toHaveBeenCalledTimes(2);
    });
    expect(getSharedSendState(WORKSPACE_ID, THREAD_ID).state).toBe("idle");
    expect(mocks.awaitTerminal).not.toHaveBeenCalled();
  });

  it("recover 无 exact live owner 时保持 recovery-required", async () => {
    mocks.turnState.mockResolvedValue(ACTIVE_TURN_STATE);
    mocks.recoverAttempt.mockResolvedValue({
      status: "unknown",
      attemptId: "attempt-restored",
      bindingKey: "codex:provider-a",
      pendingPhase: "accepted",
    });

    renderHook(() =>
      useSharedSendStateRestore(WORKSPACE_ID, THREAD_ID, true),
    );

    await waitFor(() => {
      expect(getSharedSendState(WORKSPACE_ID, THREAD_ID).state).toBe(
        "recovery-required",
      );
    });
    expect(mocks.awaitTerminal).not.toHaveBeenCalled();
  });
});
