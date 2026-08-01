// @vitest-environment jsdom
/**
 * Shared V2 发送编排单元测试（Wave 4 / Change B）。
 *
 * 覆盖：
 * - flag 路由：关闭走 V0；开启走 V2 时完整 target 必填。
 * - happy path：begin → send（透传 providerProfileId）→ commit completed。
 * - begin 早退（recovery-required / target-unavailable）：不发送、不 commit。
 * - 发送抛错且无 negative ACK 证据：recovery-required + 原样抛出 + endTurn。
 * - commit 失败（ambiguous）：mark_recovery(reason="commit-failed") + 抛出 + endTurn。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  setSharedSessionSelectedEngine,
  sendSharedSessionMessage,
  sharedSessionV2BeginTurn,
  sharedSessionV2CancelAttempt,
  sharedSessionV2PrepareContext,
  sharedSessionV2PrepareDelivery,
  sharedSessionV2DispatchTurn,
  sharedSessionV2AwaitTurnTerminal,
  sharedSessionV2MarkRecovery,
  registerSharedSessionNativeBinding,
  rebindSharedSessionNativeThread,
} = vi.hoisted(() => ({
  setSharedSessionSelectedEngine: vi.fn(),
  sendSharedSessionMessage: vi.fn(),
  sharedSessionV2BeginTurn: vi.fn(),
  sharedSessionV2CancelAttempt: vi.fn(),
  sharedSessionV2PrepareContext: vi.fn(),
  sharedSessionV2PrepareDelivery: vi.fn(),
  sharedSessionV2DispatchTurn: vi.fn(),
  sharedSessionV2AwaitTurnTerminal: vi.fn(),
  sharedSessionV2MarkRecovery: vi.fn(),
  registerSharedSessionNativeBinding: vi.fn(),
  rebindSharedSessionNativeThread: vi.fn(),
}));

vi.mock("../services/sharedSessions", () => ({
  setSharedSessionSelectedEngine,
  sendSharedSessionMessage,
  sharedSessionV2BeginTurn,
  sharedSessionV2CancelAttempt,
  sharedSessionV2PrepareContext,
  sharedSessionV2PrepareDelivery,
  sharedSessionV2DispatchTurn,
  sharedSessionV2AwaitTurnTerminal,
  sharedSessionV2MarkRecovery,
}));

vi.mock("./sharedSessionBridge", () => ({
  registerSharedSessionNativeBinding,
  rebindSharedSessionNativeThread,
}));

import {
  getSharedTargetState,
  resetSharedTargetStoreForTests,
} from "../target/targetStore";
import type { ExecutionTarget } from "../target/types";
import { sendSharedSessionTurnRouted } from "./sendSharedSessionTurn";
import {
  sendSharedSessionTurnV2,
  SharedActiveAttemptObserverError,
} from "./sendSharedSessionTurnV2";
import {
  dispatchSharedSendEvent,
  getSharedSendActiveAttemptId,
  getSharedSendState,
  resetSharedSendStateStoreForTests,
  tryAcquireSharedSend,
} from "./sharedSendStateStore";
import { setSharedV2SendOverride } from "./sharedV2SendFlag";
import { isComposerSubmitLocked } from "../target/sendStateMachine";

const BASE_INPUT = {
  workspaceId: "ws-1",
  threadId: "shared:thread-1",
  engine: "claude" as const,
  text: "hello",
  model: "sonnet-4",
  effort: "high",
  images: [],
};

const TARGET: ExecutionTarget = {
  engine: "claude",
  providerProfileId: "profile-1",
  modelCatalogEntryId: "settings-sonnet",
  model: "sonnet-4",
  providerProfileNameSnapshot: "Provider A",
  providerProfileSource: "managed",
  reasoning: { effort: "high" },
};

function mockBeginCreating() {
  sharedSessionV2BeginTurn.mockResolvedValue({
    status: "creating",
    attemptId: "attempt-1",
    logicalTurnId: "turn-1",
    bindingKey: "claude:profile-1",
  });
}

function mockContextDelivery(overrides: Record<string, unknown> = {}) {
  sharedSessionV2PrepareDelivery.mockResolvedValue({
    status: "ready",
    packageId: "package-1",
    artifactId: "artifact-1",
    artifactChecksum: "sha256:artifact",
    sourceChecksum: "sha256:source",
    throughSequenceInclusive: 0,
    mode: "portable-transcript",
    operation: "prompt-prefix",
    promptPrefix: "",
    importItems: [],
    manifest: {
      mode: "portable-transcript",
      omitted: [],
      throughSequenceInclusive: 0,
      sourceChecksum: "sha256:source",
    },
    compression: {
      estimator: "deterministic-char-div-4",
      sourceEstimatedTokens: 0,
      packageEstimatedTokens: 0,
      perCategory: [],
    },
    ackFidelity: "weak",
    ...overrides,
  });
}

describe("sendSharedSessionTurnRouted（flag 路由）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedTargetStoreForTests();
    resetSharedSendStateStoreForTests();
    window.localStorage.clear();
    setSharedSessionSelectedEngine.mockResolvedValue({ nativeThreadId: "" });
    sharedSessionV2PrepareContext.mockResolvedValue({
      status: "ready",
      mode: "delta-sync",
      omissions: [],
    });
    mockContextDelivery();
    sendSharedSessionMessage.mockResolvedValue({
      nativeThreadId: "claude:session-1",
      delivery: {
        promptAcceptance: "accepted",
        contextAcceptance: {
          status: "accepted",
          packageId: "package-1",
          sourceChecksum: "sha256:source",
          ackFidelity: "weak",
        },
        terminal: { type: "run.settled", outcome: "completed" },
      },
    });
    sharedSessionV2DispatchTurn.mockResolvedValue({
      status: "accepted",
      attemptId: "attempt-1",
      logicalTurnId: "turn-1",
      engine: "claude",
      providerProfileId: "profile-1",
      model: "sonnet-4",
      reasoningEffort: "high",
      bindingKey: "claude:profile-1",
      nativeThreadId: "claude:session-1",
      runtimeTurnId: "claude-turn-1",
      delivery: {
        promptAcceptance: "accepted",
        contextAcceptance: {
          status: "accepted",
          packageId: "package-1",
          sourceChecksum: "sha256:source",
          ackFidelity: "weak",
        },
        terminal: { type: "run.settled", outcome: "completed" },
      },
    });
    mockBeginCreating();
    sharedSessionV2AwaitTurnTerminal.mockResolvedValue({
      status: "committed",
      duplicate: false,
      sequence: 7,
      bindingKey: "claude:profile-1",
      terminal: {
        type: "run.settled",
        outcome: "completed",
        recoveryReason: null,
      },
    });
    sharedSessionV2MarkRecovery.mockResolvedValue({
      status: "recovery-required",
      bindingKey: "claude:profile-1",
    });
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("显式关闭 flag：走 V0，不触碰 V2 命令", async () => {
    setSharedV2SendOverride(false);
    const response = await sendSharedSessionTurnRouted({ ...BASE_INPUT, target: TARGET });

    expect(sendSharedSessionMessage).toHaveBeenCalledTimes(1);
    expect(sharedSessionV2BeginTurn).not.toHaveBeenCalled();
    expect(sharedSessionV2AwaitTurnTerminal).not.toHaveBeenCalled();
    expect(response).toMatchObject({ nativeThreadId: "claude:session-1" });
  });

  it("默认开启且缺 target：fail closed，不触碰 V2 RPC", async () => {
    await expect(
      sendSharedSessionTurnRouted({ ...BASE_INPUT }),
    ).rejects.toThrow("shared-v2-target-incomplete");

    expect(sharedSessionV2BeginTurn).not.toHaveBeenCalled();
    expect(sharedSessionV2PrepareContext).not.toHaveBeenCalled();
    expect(sharedSessionV2DispatchTurn).not.toHaveBeenCalled();
  });

  it("local selection source only converts to canonical local at the freeze boundary", async () => {
    const localTarget: ExecutionTarget = {
      engine: "claude",
      providerProfileId: null,
      modelCatalogEntryId: "settings-sonnet",
      model: "sonnet-4",
      providerProfileNameSnapshot: "本地配置",
      providerProfileSource: "disk",
    };
    sharedSessionV2BeginTurn.mockResolvedValue({
      status: "creating",
      attemptId: "attempt-1",
      logicalTurnId: "turn-1",
      bindingKey: "claude:default",
    });
    sharedSessionV2DispatchTurn.mockResolvedValue({
      status: "accepted",
      attemptId: "attempt-1",
      logicalTurnId: "turn-1",
      engine: "claude",
      providerProfileId: null,
      model: "sonnet-4",
      reasoningEffort: null,
      bindingKey: "claude:default",
      nativeThreadId: "claude:session-1",
      runtimeTurnId: "claude-turn-1",
      delivery: {
        promptAcceptance: "accepted",
        contextAcceptance: {
          status: "accepted",
          packageId: "package-1",
          sourceChecksum: "sha256:source",
          ackFidelity: "weak",
        },
        terminal: { type: "run.settled", outcome: "completed" },
      },
    });

    await sendSharedSessionTurnRouted({ ...BASE_INPUT, target: localTarget });

    expect(sharedSessionV2BeginTurn).toHaveBeenCalledWith(
      "ws-1",
      "shared:thread-1",
      expect.objectContaining({
        providerProfileId: null,
        providerProfileSource: "local",
      }),
      "hello",
    );
    expect(sharedSessionV2DispatchTurn).toHaveBeenCalledTimes(1);
    expect(setSharedSessionSelectedEngine).not.toHaveBeenCalled();
  });
});

describe("sendSharedSessionTurnV2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedTargetStoreForTests();
    resetSharedSendStateStoreForTests();
    window.localStorage.clear();
    setSharedSessionSelectedEngine.mockResolvedValue({ nativeThreadId: "" });
    sharedSessionV2PrepareContext.mockResolvedValue({
      status: "ready",
      mode: "delta-sync",
      omissions: [],
    });
    mockContextDelivery();
    sendSharedSessionMessage.mockResolvedValue({
      nativeThreadId: "claude:session-1",
    });
    sharedSessionV2DispatchTurn.mockResolvedValue({
      status: "accepted",
      attemptId: "attempt-1",
      logicalTurnId: "turn-1",
      engine: "claude",
      providerProfileId: "profile-1",
      model: "sonnet-4",
      reasoningEffort: "high",
      bindingKey: "claude:profile-1",
      nativeThreadId: "claude:session-1",
      runtimeTurnId: "claude-turn-1",
      delivery: {
        promptAcceptance: "accepted",
        contextAcceptance: {
          status: "accepted",
          packageId: "package-1",
          sourceChecksum: "sha256:source",
          ackFidelity: "weak",
        },
        terminal: { type: "run.settled", outcome: "completed" },
      },
    });
    mockBeginCreating();
    sharedSessionV2AwaitTurnTerminal.mockResolvedValue({
      status: "committed",
      duplicate: false,
      sequence: 7,
      bindingKey: "claude:profile-1",
      terminal: {
        type: "run.settled",
        outcome: "completed",
        recoveryReason: null,
      },
    });
    sharedSessionV2MarkRecovery.mockResolvedValue({
      status: "recovery-required",
      bindingKey: "claude:profile-1",
    });
    sharedSessionV2CancelAttempt.mockResolvedValue({
      status: "cancelled",
      attemptId: "attempt-1",
    });
  });

  it("direct V2 entry rejects a partial target before state or RPC side effects", async () => {
    await expect(
      sendSharedSessionTurnV2({
        ...BASE_INPUT,
        target: { engine: "claude" },
      }),
    ).rejects.toThrow("shared-v2-target-incomplete");

    expect(sharedSessionV2BeginTurn).not.toHaveBeenCalled();
    expect(sharedSessionV2PrepareContext).not.toHaveBeenCalled();
    expect(getSharedTargetState("ws-1", "shared:thread-1")).toEqual({
      selectedNextTarget: null,
      activeTurnTarget: null,
    });
  });

  it("returns a typed block with zero RPC side effects when the Shared Session is non-idle", async () => {
    dispatchSharedSendEvent("ws-1", "shared:thread-1", { type: "send" });

    await expect(
      sendSharedSessionTurnV2({ ...BASE_INPUT, target: TARGET }),
    ).resolves.toEqual({
      status: "blocked",
      state: "preparing-context",
      reason: "shared-send-not-idle",
    });

    expect(sharedSessionV2PrepareContext).not.toHaveBeenCalled();
    expect(sharedSessionV2BeginTurn).not.toHaveBeenCalled();
    expect(sharedSessionV2PrepareDelivery).not.toHaveBeenCalled();
    expect(sharedSessionV2DispatchTurn).not.toHaveBeenCalled();
    expect(sharedSessionV2AwaitTurnTerminal).not.toHaveBeenCalled();
  });

  it("consumes a Composer admission exactly once before any V2 RPC", async () => {
    const admission = tryAcquireSharedSend("ws-1", "shared:thread-1");
    expect(admission.acquired).toBe(true);
    if (!admission.acquired) {
      throw new Error("expected Shared admission");
    }

    await expect(
      sendSharedSessionTurnV2({
        ...BASE_INPUT,
        target: TARGET,
        sharedSendAdmissionRevision: admission.revision,
      }),
    ).resolves.toMatchObject({
      v2: { attemptId: "attempt-1", committed: true },
    });

    sharedSessionV2PrepareContext.mockClear();
    sharedSessionV2BeginTurn.mockClear();
    sharedSessionV2DispatchTurn.mockClear();
    await expect(
      sendSharedSessionTurnV2({
        ...BASE_INPUT,
        target: TARGET,
        sharedSendAdmissionRevision: admission.revision,
      }),
    ).resolves.toEqual({
      status: "blocked",
      state: "idle",
      reason: "shared-send-admission-stale",
    });
    expect(sharedSessionV2PrepareContext).not.toHaveBeenCalled();
    expect(sharedSessionV2BeginTurn).not.toHaveBeenCalled();
    expect(sharedSessionV2DispatchTurn).not.toHaveBeenCalled();
  });

  it("happy path：begin → attempt-owned dispatch → commit confirmation", async () => {
    const result = await sendSharedSessionTurnV2({ ...BASE_INPUT, target: TARGET });

    expect(setSharedSessionSelectedEngine).not.toHaveBeenCalled();
    expect(sendSharedSessionMessage).not.toHaveBeenCalled();
    expect(sharedSessionV2BeginTurn).toHaveBeenCalledWith(
      "ws-1",
      "shared:thread-1",
      expect.objectContaining({
        modelCatalogEntryId: "settings-sonnet",
        model: "sonnet-4",
      }),
      "hello",
    );
    // actual-send 只携带 durable attempt + artifact identity 与非 Target 操作参数。
    expect(sharedSessionV2DispatchTurn).toHaveBeenCalledWith(
      "ws-1",
      "shared:thread-1",
      {
        attemptId: "attempt-1",
        artifactId: "artifact-1",
        artifactChecksum: "sha256:artifact",
        disableThinking: undefined,
        accessMode: undefined,
        images: [],
        collaborationMode: undefined,
        preferredLanguage: undefined,
        customSpecRoot: undefined,
      },
    );
    expect(sharedSessionV2AwaitTurnTerminal).toHaveBeenCalledWith(
      "ws-1",
      "shared:thread-1",
      "attempt-1",
    );
    expect(sharedSessionV2MarkRecovery).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      nativeThreadId: "claude:session-1",
      v2: {
        attemptId: "attempt-1",
        logicalTurnId: "turn-1",
        bindingKey: "claude:profile-1",
        committed: true,
        duplicate: false,
      },
    });
    // endTurn 兜底：active 快照已清除。
    expect(getSharedTargetState("ws-1", "shared:thread-1").activeTurnTarget).toBeNull();
  });

  it("poisoned legacy flat fields cannot cross the V2 Runtime boundary", async () => {
    await sendSharedSessionTurnV2({
      ...BASE_INPUT,
      engine: "codex",
      model: "kimi-for-coding",
      effort: "low",
      target: TARGET,
    });

    expect(sharedSessionV2BeginTurn).toHaveBeenCalledWith(
      "ws-1",
      "shared:thread-1",
      expect.objectContaining({
        engine: "claude",
        modelCatalogEntryId: "settings-sonnet",
        model: "sonnet-4",
        reasoningEffort: "high",
        providerProfileId: "profile-1",
      }),
      "hello",
    );
    const dispatchParams = sharedSessionV2DispatchTurn.mock.calls[0]?.[2];
    expect(dispatchParams).toEqual(
      expect.objectContaining({
        attemptId: "attempt-1",
        artifactId: "artifact-1",
        artifactChecksum: "sha256:artifact",
      }),
    );
    expect(dispatchParams).not.toHaveProperty("engine");
    expect(dispatchParams).not.toHaveProperty("model");
    expect(dispatchParams).not.toHaveProperty("effort");
    expect(dispatchParams).not.toHaveProperty("providerProfileId");
    expect(dispatchParams).not.toHaveProperty("text");
    expect(sendSharedSessionMessage).not.toHaveBeenCalled();
  });

  it("freezes one target snapshot before the first async boundary", async () => {
    const mutableTarget: ExecutionTarget = {
      ...TARGET,
      reasoning: { ...TARGET.reasoning! },
    };
    sharedSessionV2PrepareContext.mockImplementationOnce(async () => {
      mutableTarget.engine = "codex";
      mutableTarget.providerProfileId = "profile-mutated";
      mutableTarget.modelCatalogEntryId = "catalog-mutated";
      mutableTarget.model = "runtime-mutated";
      mutableTarget.reasoning = { effort: "low" };
      return {
        status: "ready",
        mode: "delta-sync",
        omissions: [],
      };
    });

    await sendSharedSessionTurnV2({
      ...BASE_INPUT,
      target: mutableTarget,
    });

    expect(sharedSessionV2BeginTurn).toHaveBeenCalledWith(
      "ws-1",
      "shared:thread-1",
      expect.objectContaining({
        engine: "claude",
        providerProfileId: "profile-1",
        modelCatalogEntryId: "settings-sonnet",
        model: "sonnet-4",
        reasoningEffort: "high",
      }),
      "hello",
    );
    expect(registerSharedSessionNativeBinding).toHaveBeenCalledWith(
      expect.objectContaining({
        engine: "claude",
        providerProfileId: "profile-1",
        attemptId: "attempt-1",
      }),
    );
  });

  it("production-shaped terminal closes the first turn and allows a second turn", async () => {
    sharedSessionV2DispatchTurn.mockResolvedValue({
      status: "accepted",
      attemptId: "attempt-1",
      logicalTurnId: "turn-1",
      engine: "claude",
      providerProfileId: "profile-1",
      model: "sonnet-4",
      reasoningEffort: "high",
      bindingKey: "claude:profile-1",
      nativeThreadId: "claude:session-1",
      runtimeTurnId: "claude-turn-1",
      delivery: {
        promptAcceptance: "accepted",
        contextAcceptance: {
          status: "accepted",
          packageId: "package-1",
          sourceChecksum: "sha256:source",
          ackFidelity: "weak",
        },
        terminal: { type: "run.settled", outcome: "completed" },
      },
    });
    await sendSharedSessionTurnV2({ ...BASE_INPUT, target: TARGET });
    expect(getSharedSendState("ws-1", "shared:thread-1").state).toBe("idle");
    expect(
      isComposerSubmitLocked(
        getSharedSendState("ws-1", "shared:thread-1").state,
      ),
    ).toBe(false);

    await sendSharedSessionTurnV2({
      ...BASE_INPUT,
      text: "second turn",
      target: TARGET,
    });

    expect(sharedSessionV2AwaitTurnTerminal).toHaveBeenCalledTimes(2);
    expect(getSharedSendState("ws-1", "shared:thread-1").state).toBe("idle");
  });

  it("lossy preview continues directly to Tx1 and Runtime dispatch", async () => {
    sharedSessionV2PrepareContext.mockResolvedValue({
      status: "degraded",
      mode: "delta-sync",
      omissions: ["2 older turns omitted"],
    });

    await expect(
      sendSharedSessionTurnV2({ ...BASE_INPUT, target: TARGET }),
    ).resolves.toMatchObject({
      v2: { attemptId: "attempt-1", committed: true },
    });

    expect(sharedSessionV2BeginTurn).toHaveBeenCalledTimes(1);
    expect(sharedSessionV2DispatchTurn).toHaveBeenCalledTimes(1);
    expect(getSharedSendState("ws-1", "shared:thread-1").state).toBe("idle");
  });

  it("destination-owned preview is audit evidence, not a degraded confirmation", async () => {
    sharedSessionV2PrepareContext.mockResolvedValue({
      status: "degraded",
      mode: "native-delta",
      omissions: ["destination-owned: already present"],
      manifest: {
        mode: "native-delta",
        omitted: [
          {
            entryId: "entry-owned",
            category: "destination-owned",
            reason: "already present",
            disposition: "not-retrievable",
          },
        ],
        throughSequenceInclusive: 6,
        sourceChecksum: "sha256:owned",
      },
    });

    await expect(
      sendSharedSessionTurnV2({ ...BASE_INPUT, target: TARGET }),
    ).resolves.toMatchObject({
      v2: { attemptId: "attempt-1", committed: true },
    });

    expect(sharedSessionV2BeginTurn).toHaveBeenCalledTimes(1);
    expect(sharedSessionV2DispatchTurn).toHaveBeenCalledTimes(1);
    expect(getSharedSendState("ws-1", "shared:thread-1").state).toBe("idle");
  });

  it("destination-owned actual package dispatches without a migration gate", async () => {
    mockContextDelivery({
      status: "degraded",
      mode: "native-delta",
      promptPrefix: "",
      manifest: {
        mode: "native-delta",
        omitted: [
          {
            entryId: "entry-owned",
            category: "destination-owned",
            reason: "already present",
            disposition: "not-retrievable",
          },
        ],
        throughSequenceInclusive: 6,
        sourceChecksum: "sha256:owned",
      },
    });

    await expect(
      sendSharedSessionTurnV2({ ...BASE_INPUT, target: TARGET }),
    ).resolves.toMatchObject({
      v2: { attemptId: "attempt-1", committed: true },
    });

    expect(sharedSessionV2DispatchTurn).toHaveBeenCalledTimes(1);
    expect(getSharedSendState("ws-1", "shared:thread-1").state).toBe("idle");
  });

  it("valid degraded preview and actual package dispatch without confirmation", async () => {
    sharedSessionV2PrepareContext.mockResolvedValue({
      status: "degraded",
      mode: "preview-mode",
      omissions: ["preview omission"],
    });
    mockContextDelivery({
      status: "degraded",
      packageId: "actual-package-1",
      sourceChecksum: "sha256:actual-source",
      mode: "portable-transcript",
      manifest: {
        mode: "portable-transcript",
        omitted: [
          {
            entryId: "entry-1",
            category: "reasoning",
            reason: "budget",
            disposition: "retrievable-on-demand",
          },
        ],
        throughSequenceInclusive: 0,
        sourceChecksum: "sha256:actual-source",
      },
    });
    sharedSessionV2DispatchTurn.mockResolvedValue({
      status: "accepted",
      attemptId: "attempt-1",
      logicalTurnId: "turn-1",
      engine: "claude",
      providerProfileId: "profile-1",
      model: "sonnet-4",
      reasoningEffort: "high",
      bindingKey: "claude:profile-1",
      nativeThreadId: "claude:session-1",
      runtimeTurnId: "claude-turn-1",
      delivery: {
        promptAcceptance: "accepted",
        contextAcceptance: {
          status: "accepted",
          packageId: "actual-package-1",
          sourceChecksum: "sha256:actual-source",
          ackFidelity: "weak",
        },
        terminal: { type: "run.settled", outcome: "completed" },
      },
    });

    await expect(
      sendSharedSessionTurnV2({ ...BASE_INPUT, target: TARGET }),
    ).resolves.toMatchObject({
      v2: { attemptId: "attempt-1", committed: true },
    });

    expect(sharedSessionV2BeginTurn).toHaveBeenCalledTimes(1);
    expect(sharedSessionV2PrepareDelivery).toHaveBeenCalledWith(
      "ws-1",
      "shared:thread-1",
      "attempt-1",
    );
    expect(sharedSessionV2CancelAttempt).not.toHaveBeenCalled();
    expect(sharedSessionV2DispatchTurn).toHaveBeenCalledTimes(1);
    expect(getSharedSendState("ws-1", "shared:thread-1").state).toBe("idle");
  });

  it("unsupported historical blocks remain diagnostics and do not expose a cancel gate", async () => {
    mockContextDelivery({
      status: "degraded",
      packageId: "package-1",
      sourceChecksum: "sha256:source",
      mode: "checkpoint",
      manifest: {
        mode: "checkpoint",
        omitted: [
          {
            entryId: "entry-2",
            category: "tool-output",
            reason: "unsupported",
            disposition: "not-retrievable",
          },
        ],
        throughSequenceInclusive: 0,
        sourceChecksum: "sha256:source",
      },
    });

    await expect(
      sendSharedSessionTurnV2({ ...BASE_INPUT, target: TARGET }),
    ).resolves.toMatchObject({
      v2: { attemptId: "attempt-1", committed: true },
    });

    expect(sharedSessionV2CancelAttempt).not.toHaveBeenCalled();
    expect(sharedSessionV2DispatchTurn).toHaveBeenCalledTimes(1);
    expect(getSharedSendState("ws-1", "shared:thread-1").state).toBe("idle");
    expect(
      getSharedSendActiveAttemptId("ws-1", "shared:thread-1"),
    ).toBeNull();
    expect(
      getSharedTargetState("ws-1", "shared:thread-1").activeTurnTarget,
    ).toBeNull();
  });

  it("prepare_context 失败时安全回 idle", async () => {
    const prepareError = new Error("snapshot unavailable");
    sharedSessionV2PrepareContext.mockRejectedValue(prepareError);

    await expect(
      sendSharedSessionTurnV2({ ...BASE_INPUT, target: TARGET }),
    ).rejects.toBe(prepareError);

    expect(sharedSessionV2BeginTurn).not.toHaveBeenCalled();
    expect(sendSharedSessionMessage).not.toHaveBeenCalled();
    expect(sharedSessionV2DispatchTurn).not.toHaveBeenCalled();
    expect(getSharedSendState("ws-1", "shared:thread-1").state).toBe("idle");
  });

  it("begin_turn RPC 失败时进入 recovery-required，禁止盲目重发", async () => {
    const beginError = new Error("Tx1 response lost");
    sharedSessionV2BeginTurn.mockRejectedValue(beginError);

    await expect(
      sendSharedSessionTurnV2({ ...BASE_INPUT, target: TARGET }),
    ).rejects.toBe(beginError);

    expect(sharedSessionV2DispatchTurn).not.toHaveBeenCalled();
    expect(getSharedSendState("ws-1", "shared:thread-1").state).toBe(
      "recovery-required",
    );
  });

  it("begin_turn creating 缺少 identity 时 fail closed 并锁住会话", async () => {
    sharedSessionV2BeginTurn.mockResolvedValue({
      status: "creating",
      bindingKey: "claude:profile-1",
    });

    await expect(
      sendSharedSessionTurnV2({ ...BASE_INPUT, target: TARGET }),
    ).rejects.toThrow("缺少 attemptId/logicalTurnId");

    expect(sharedSessionV2DispatchTurn).not.toHaveBeenCalled();
    // Rust 未返回 attemptId 时不能伪造路由身份去落 recovery。
    expect(sharedSessionV2MarkRecovery).not.toHaveBeenCalled();
    expect(getSharedSendState("ws-1", "shared:thread-1").state).toBe(
      "recovery-required",
    );
  });

  it("begin 返回 recovery-required：不发送、不 commit，直接早退", async () => {
    sharedSessionV2BeginTurn.mockResolvedValue({
      status: "recovery-required",
      bindingKey: "claude:profile-1",
      reason: "provisioning-crash-window",
    });

    const result = await sendSharedSessionTurnV2({ ...BASE_INPUT, target: TARGET });

    expect(result).toEqual({
      status: "recovery-required",
      bindingKey: "claude:profile-1",
      reason: "provisioning-crash-window",
    });
    expect(sendSharedSessionMessage).not.toHaveBeenCalled();
    expect(sharedSessionV2DispatchTurn).not.toHaveBeenCalled();
    expect(sharedSessionV2AwaitTurnTerminal).not.toHaveBeenCalled();
    // 未 beginTurn，无需 endTurn；store 保持空。
    expect(getSharedTargetState("ws-1", "shared:thread-1").activeTurnTarget).toBeNull();
  });

  it("begin 返回 target-unavailable：不发送、不 commit，直接早退", async () => {
    sharedSessionV2BeginTurn.mockResolvedValue({
      status: "target-unavailable",
      reason: "unsupported-engine",
    });

    const result = await sendSharedSessionTurnV2({ ...BASE_INPUT, target: TARGET });

    expect(result).toEqual({
      status: "target-unavailable",
      bindingKey: undefined,
      reason: "unsupported-engine",
    });
    expect(sendSharedSessionMessage).not.toHaveBeenCalled();
    expect(sharedSessionV2DispatchTurn).not.toHaveBeenCalled();
    expect(sharedSessionV2AwaitTurnTerminal).not.toHaveBeenCalled();
  });

  it("发送抛错且无 negative ACK 证据：进入 recovery，不伪造 failed commit", async () => {
    const sendError = new Error("runtime disconnected");
    sharedSessionV2DispatchTurn.mockRejectedValue(sendError);

    await expect(
      sendSharedSessionTurnV2({ ...BASE_INPUT, target: TARGET }),
    ).rejects.toBe(sendError);

    expect(sharedSessionV2AwaitTurnTerminal).not.toHaveBeenCalled();
    expect(sharedSessionV2MarkRecovery).toHaveBeenCalledWith(
      "ws-1",
      "shared:thread-1",
      "attempt-1",
      "runtime-delivery-ambiguous: runtime disconnected",
    );
    expect(getSharedSendState("ws-1", "shared:thread-1").state).toBe(
      "recovery-required",
    );
    expect(getSharedTargetState("ws-1", "shared:thread-1").activeTurnTarget).toBeNull();
  });

  it("typed stale Binding result enters Shared recovery without throwing raw provider error", async () => {
    sharedSessionV2DispatchTurn.mockRejectedValue(
      new Error(
        "binding-recovery-required: native-session-not-found: No conversation found with session ID",
      ),
    );

    await expect(
      sendSharedSessionTurnV2({ ...BASE_INPUT, target: TARGET }),
    ).resolves.toEqual({
      status: "recovery-required",
      bindingKey: "claude:profile-1",
      reason: "native-session-not-found",
    });

    expect(sharedSessionV2AwaitTurnTerminal).not.toHaveBeenCalled();
    expect(sharedSessionV2MarkRecovery).not.toHaveBeenCalled();
    expect(getSharedSendState("ws-1", "shared:thread-1").state).toBe(
      "recovery-required",
    );
    expect(getSharedSendActiveAttemptId("ws-1", "shared:thread-1")).toBeNull();
  });

  it("typed stale Binding terminal commits once and keeps Shared recovery visible", async () => {
    sharedSessionV2AwaitTurnTerminal.mockResolvedValue({
      status: "committed",
      duplicate: false,
      sequence: 8,
      bindingKey: "claude:profile-1",
      terminal: {
        type: "run.settled",
        outcome: "failed",
        recoveryReason: "native-session-not-found",
      },
    });
    sharedSessionV2DispatchTurn.mockResolvedValue({
      status: "accepted",
      attemptId: "attempt-1",
      logicalTurnId: "turn-1",
      engine: "claude",
      providerProfileId: "profile-1",
      model: "sonnet-4",
      reasoningEffort: "high",
      bindingKey: "claude:profile-1",
      nativeThreadId: "claude:session-1",
      runtimeTurnId: "claude-turn-1",
      delivery: {
        promptAcceptance: "accepted",
        contextAcceptance: {
          status: "accepted",
          packageId: "package-1",
          sourceChecksum: "sha256:source",
          ackFidelity: "weak",
        },
        terminal: {
          type: "run.settled",
          outcome: "failed",
          recoveryReason: "native-session-not-found",
        },
      },
    });

    await expect(
      sendSharedSessionTurnV2({ ...BASE_INPUT, target: TARGET }),
    ).resolves.toEqual({
      status: "recovery-required",
      bindingKey: "claude:profile-1",
      reason: "native-session-not-found",
    });

    expect(sharedSessionV2AwaitTurnTerminal).toHaveBeenCalledTimes(1);
    expect(sharedSessionV2MarkRecovery).not.toHaveBeenCalled();
    expect(getSharedSendState("ws-1", "shared:thread-1").state).toBe(
      "recovery-required",
    );
  });

  it("deterministic context prepare failure confirms failed terminal and unlocks", async () => {
    const prepareError = new Error(
      "context-prepare-failed: artifact checksum mismatch",
    );
    sharedSessionV2PrepareDelivery.mockRejectedValue(prepareError);

    await expect(
      sendSharedSessionTurnV2({ ...BASE_INPUT, target: TARGET }),
    ).rejects.toBe(prepareError);

    expect(sharedSessionV2DispatchTurn).not.toHaveBeenCalled();
    expect(sharedSessionV2AwaitTurnTerminal).toHaveBeenCalledWith(
      "ws-1",
      "shared:thread-1",
      "attempt-1",
    );
    expect(sharedSessionV2MarkRecovery).not.toHaveBeenCalled();
    expect(getSharedSendState("ws-1", "shared:thread-1").state).toBe("idle");
  });

  it("typed Provider rejection confirms failed canonical terminal without recovery", async () => {
    const rejection = new Error(
      "target-provider-rejected: kimi-for-coding is not supported",
    );
    sharedSessionV2DispatchTurn.mockRejectedValue(rejection);

    await expect(
      sendSharedSessionTurnV2({ ...BASE_INPUT, target: TARGET }),
    ).rejects.toBe(rejection);

    expect(sharedSessionV2AwaitTurnTerminal).toHaveBeenCalledWith(
      "ws-1",
      "shared:thread-1",
      "attempt-1",
    );
    expect(sharedSessionV2MarkRecovery).not.toHaveBeenCalled();
    expect(getSharedSendState("ws-1", "shared:thread-1").state).toBe("idle");
  });

  it("missing typed prompt ACK enters recovery without accepting or committing", async () => {
    sharedSessionV2DispatchTurn.mockResolvedValue({
      status: "accepted",
      attemptId: "attempt-1",
      logicalTurnId: "turn-1",
      engine: "claude",
      providerProfileId: "profile-1",
      model: "sonnet-4",
      reasoningEffort: "high",
      bindingKey: "claude:profile-1",
      nativeThreadId: "claude:session-1",
      delivery: {
        terminal: { type: "run.settled", outcome: "completed" },
      },
    });

    await expect(
      sendSharedSessionTurnV2({ ...BASE_INPUT, target: TARGET }),
    ).rejects.toThrow("typed prompt ACK");

    expect(sharedSessionV2AwaitTurnTerminal).not.toHaveBeenCalled();
    expect(sharedSessionV2MarkRecovery).toHaveBeenCalledWith(
      "ws-1",
      "shared:thread-1",
      "attempt-1",
      "typed-prompt-ack-missing-or-mismatched",
    );
  });

  it("rejects a typed ACK whose Provider or Model differs from the frozen attempt", async () => {
    sharedSessionV2DispatchTurn.mockResolvedValue({
      status: "accepted",
      attemptId: "attempt-1",
      logicalTurnId: "turn-1",
      engine: "claude",
      providerProfileId: "profile-poisoned",
      model: "wrong-runtime-model",
      reasoningEffort: "low",
      bindingKey: "claude:profile-1",
      nativeThreadId: "claude:session-1",
      delivery: {
        promptAcceptance: "accepted",
        contextAcceptance: {
          status: "accepted",
          packageId: "package-1",
          sourceChecksum: "sha256:source",
        },
      },
    });

    await expect(
      sendSharedSessionTurnV2({ ...BASE_INPUT, target: TARGET }),
    ).rejects.toThrow("typed prompt ACK");

    expect(sharedSessionV2AwaitTurnTerminal).not.toHaveBeenCalled();
    expect(sharedSessionV2MarkRecovery).toHaveBeenCalledWith(
      "ws-1",
      "shared:thread-1",
      "attempt-1",
      "typed-prompt-ack-missing-or-mismatched",
    );
  });

  it("Claude accepted ACK waits for the backend durable terminal without a frontend event subscriber", async () => {
    sharedSessionV2DispatchTurn.mockResolvedValue({
      status: "accepted",
      attemptId: "attempt-1",
      logicalTurnId: "turn-1",
      engine: "claude",
      providerProfileId: "profile-1",
      model: "sonnet-4",
      reasoningEffort: "high",
      bindingKey: "claude:profile-1",
      nativeThreadId: "claude:session-1",
      runtimeTurnId: "claude-turn-1",
      delivery: {
        promptAcceptance: "accepted",
        contextAcceptance: {
          status: "accepted",
          packageId: "package-1",
          sourceChecksum: "sha256:source",
        },
      },
    });
    await sendSharedSessionTurnV2({ ...BASE_INPUT, target: TARGET });

    expect(sharedSessionV2AwaitTurnTerminal).toHaveBeenCalledWith(
      "ws-1",
      "shared:thread-1",
      "attempt-1",
    );
    expect(sharedSessionV2MarkRecovery).not.toHaveBeenCalled();
    expect(getSharedSendState("ws-1", "shared:thread-1").state).toBe("idle");
  });

  it("inline terminal remains a presentation hint while durable await confirms completion", async () => {
    sharedSessionV2DispatchTurn.mockResolvedValue({
      status: "accepted",
      attemptId: "attempt-1",
      logicalTurnId: "turn-1",
      engine: "claude",
      providerProfileId: "profile-1",
      model: "sonnet-4",
      reasoningEffort: "high",
      bindingKey: "claude:profile-1",
      nativeThreadId: "claude:session-1",
      runtimeTurnId: "claude-turn-1",
      alreadySettled: true,
      delivery: {
        promptAcceptance: "accepted",
        contextAcceptance: {
          status: "accepted",
          packageId: "package-1",
          sourceChecksum: "sha256:source",
        },
        terminal: { type: "run.settled", outcome: "completed" },
      },
    });

    await sendSharedSessionTurnV2({ ...BASE_INPUT, target: TARGET });

    expect(sharedSessionV2AwaitTurnTerminal).toHaveBeenCalledWith(
      "ws-1",
      "shared:thread-1",
      "attempt-1",
    );
    expect(getSharedSendState("ws-1", "shared:thread-1").state).toBe("idle");
  });

  it("Codex uses the same backend durable terminal contract", async () => {
    sharedSessionV2BeginTurn.mockResolvedValue({
      status: "creating",
      attemptId: "attempt-1",
      logicalTurnId: "turn-1",
      bindingKey: "codex:profile-1",
    });
    sharedSessionV2DispatchTurn.mockResolvedValue({
      status: "accepted",
      attemptId: "attempt-1",
      logicalTurnId: "turn-1",
      engine: "codex",
      providerProfileId: "profile-1",
      model: "gpt-5",
      bindingKey: "codex:profile-1",
      nativeThreadId: "codex-native-1",
      runtimeTurnId: "runtime-turn-1",
      delivery: {
        promptAcceptance: "accepted",
        contextAcceptance: {
          status: "accepted",
          packageId: "package-1",
          sourceChecksum: "sha256:source",
        },
      },
    });
    await sendSharedSessionTurnV2({
      ...BASE_INPUT,
      engine: "codex",
      target: {
        engine: "codex",
        providerProfileId: "profile-1",
        modelCatalogEntryId: "settings-gpt-5",
        model: "gpt-5",
        providerProfileNameSnapshot: "Provider A",
        providerProfileSource: "managed",
      },
    });

    expect(sharedSessionV2AwaitTurnTerminal).toHaveBeenCalledWith(
      "ws-1",
      "shared:thread-1",
      "attempt-1",
    );
  });

  it("发送错误的 recovery 落盘失败时仍保留 recovery UI 并抛原错误", async () => {
    const sendError = new Error("runtime timeout");
    sharedSessionV2DispatchTurn.mockRejectedValue(sendError);
    sharedSessionV2MarkRecovery.mockRejectedValue(new Error("event log unavailable"));

    await expect(
      sendSharedSessionTurnV2({ ...BASE_INPUT, target: TARGET }),
    ).rejects.toBe(sendError);

    expect(sharedSessionV2AwaitTurnTerminal).not.toHaveBeenCalled();
    expect(getSharedSendState("ws-1", "shared:thread-1").state).toBe(
      "recovery-required",
    );
    expect(sharedSessionV2MarkRecovery).toHaveBeenCalledWith(
      "ws-1",
      "shared:thread-1",
      "attempt-1",
      "runtime-delivery-ambiguous: runtime timeout",
    );
    expect(getSharedTargetState("ws-1", "shared:thread-1").activeTurnTarget).toBeNull();
  });

  it("durable terminal observer 断开但 owner active：保留 Attempt 生命周期", async () => {
    const commitError = new Error("event log unavailable");
    sharedSessionV2AwaitTurnTerminal.mockRejectedValue(commitError);
    sharedSessionV2MarkRecovery.mockResolvedValue({
      status: "active",
      attemptId: "attempt-1",
      bindingKey: "claude:profile-1",
      nativeThreadId: "claude:session-1",
      runtimeTurnId: "claude-turn-1",
      executionTargetSnapshot: {
        engine: "claude",
        providerProfileId: "profile-1",
        modelCatalogEntryId: "settings-sonnet",
        model: "sonnet-4",
        reasoning: { effort: "high" },
        providerProfileNameSnapshot: "Provider A",
        providerProfileSource: "managed",
        runtimeCapabilityFingerprint: null,
      },
    });

    await expect(
      sendSharedSessionTurnV2({ ...BASE_INPUT, target: TARGET }),
    ).rejects.toMatchObject({
      name: "SharedActiveAttemptObserverError",
      attemptId: "attempt-1",
      observerCause: commitError,
    } satisfies Partial<SharedActiveAttemptObserverError>);

    expect(sharedSessionV2MarkRecovery).toHaveBeenCalledWith(
      "ws-1",
      "shared:thread-1",
      "attempt-1",
      "terminal-await-failed: event log unavailable",
    );
    expect(getSharedSendState("ws-1", "shared:thread-1").state).toBe(
      "recovery-required",
    );
    expect(
      getSharedSendActiveAttemptId("ws-1", "shared:thread-1"),
    ).toBe("attempt-1");
    expect(
      getSharedTargetState("ws-1", "shared:thread-1").activeTurnTarget,
    ).toMatchObject({
      engine: "claude",
      model: "sonnet-4",
    });
  });

  it("terminal observer 与 recovery RPC 同时断开：仍保留 accepted Attempt owner", async () => {
    const observerError = new Error("terminal observer detached");
    sharedSessionV2AwaitTurnTerminal.mockRejectedValue(observerError);
    sharedSessionV2MarkRecovery.mockRejectedValue(
      new Error("recovery transport unavailable"),
    );

    await expect(
      sendSharedSessionTurnV2({ ...BASE_INPUT, target: TARGET }),
    ).rejects.toMatchObject({
      name: "SharedActiveAttemptObserverError",
      attemptId: "attempt-1",
      observerCause: observerError,
    } satisfies Partial<SharedActiveAttemptObserverError>);

    expect(
      getSharedSendActiveAttemptId("ws-1", "shared:thread-1"),
    ).toBe("attempt-1");
    expect(
      getSharedTargetState("ws-1", "shared:thread-1").activeTurnTarget,
    ).toMatchObject({ engine: "claude", model: "sonnet-4" });
  });

  it("terminal await 断开但 mark recovery 发现 durable commit：按成功收口", async () => {
    sharedSessionV2AwaitTurnTerminal.mockRejectedValue(
      new Error("terminal response lost"),
    );
    sharedSessionV2MarkRecovery.mockResolvedValue({
      status: "terminal-committed",
      attemptId: "attempt-1",
      bindingKey: "claude:profile-1",
      sequence: 42,
    });

    await expect(
      sendSharedSessionTurnV2({ ...BASE_INPUT, target: TARGET }),
    ).resolves.toMatchObject({
      v2: {
        attemptId: "attempt-1",
        bindingKey: "claude:profile-1",
        committed: true,
      },
    });
    expect(getSharedSendState("ws-1", "shared:thread-1").state).toBe("idle");
    expect(
      getSharedTargetState("ws-1", "shared:thread-1").activeTurnTarget,
    ).toBeNull();
  });

  it("frontend terminal event absence cannot strand a durable committed send", async () => {
    await expect(
      sendSharedSessionTurnV2({ ...BASE_INPUT, target: TARGET }),
    ).resolves.toMatchObject({
      v2: { attemptId: "attempt-1", committed: true },
    });

    expect(sharedSessionV2AwaitTurnTerminal).toHaveBeenCalledWith(
      "ws-1",
      "shared:thread-1",
      "attempt-1",
    );
    expect(sharedSessionV2MarkRecovery).not.toHaveBeenCalled();
    expect(getSharedSendState("ws-1", "shared:thread-1").state).toBe("idle");
  });
});
