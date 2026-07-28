// @vitest-environment jsdom
/**
 * Shared V2 发送编排单元测试（Wave 4 / Change B）。
 *
 * 覆盖：
 * - flag 路由：关闭走 V0，开启走 V2（缺 target 时用 engine/model/effort 构造默认 target）。
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
  sharedSessionV2CommitTurn,
  sharedSessionV2MarkRecovery,
  registerSharedSessionNativeBinding,
  rebindSharedSessionNativeThread,
} = vi.hoisted(() => ({
  setSharedSessionSelectedEngine: vi.fn(),
  sendSharedSessionMessage: vi.fn(),
  sharedSessionV2BeginTurn: vi.fn(),
  sharedSessionV2CommitTurn: vi.fn(),
  sharedSessionV2MarkRecovery: vi.fn(),
  registerSharedSessionNativeBinding: vi.fn(),
  rebindSharedSessionNativeThread: vi.fn(),
}));

vi.mock("../services/sharedSessions", () => ({
  setSharedSessionSelectedEngine,
  sendSharedSessionMessage,
  sharedSessionV2BeginTurn,
  sharedSessionV2CommitTurn,
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
import { sendSharedSessionTurnV2 } from "./sendSharedSessionTurnV2";
import { getSharedSendState } from "./sharedSendStateStore";
import { setSharedV2SendOverride } from "./sharedV2SendFlag";

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
  model: "sonnet-4",
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

describe("sendSharedSessionTurnRouted（flag 路由）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedTargetStoreForTests();
    window.localStorage.clear();
    setSharedSessionSelectedEngine.mockResolvedValue({ nativeThreadId: "" });
    sendSharedSessionMessage.mockResolvedValue({ nativeThreadId: "claude:session-1" });
    mockBeginCreating();
    sharedSessionV2CommitTurn.mockResolvedValue({
      status: "committed",
      duplicate: false,
      bindingKey: "claude:profile-1",
    });
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("flag 关闭：走 V0，不触碰 V2 命令", async () => {
    const response = await sendSharedSessionTurnRouted({ ...BASE_INPUT, target: TARGET });

    expect(sendSharedSessionMessage).toHaveBeenCalledTimes(1);
    expect(sharedSessionV2BeginTurn).not.toHaveBeenCalled();
    expect(sharedSessionV2CommitTurn).not.toHaveBeenCalled();
    expect(response).toEqual({ nativeThreadId: "claude:session-1" });
  });

  it("flag 开启且缺 target：用 engine/model/effort 构造默认 target 走 V2", async () => {
    setSharedV2SendOverride(true);

    await sendSharedSessionTurnRouted({ ...BASE_INPUT });

    expect(sharedSessionV2BeginTurn).toHaveBeenCalledWith(
      "ws-1",
      "shared:thread-1",
      expect.objectContaining({
        engine: "claude",
        providerProfileId: null,
        model: "sonnet-4",
        reasoningEffort: "high",
      }),
      "hello",
    );
    expect(sharedSessionV2CommitTurn).toHaveBeenCalledTimes(1);
  });
});

describe("sendSharedSessionTurnV2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedTargetStoreForTests();
    window.localStorage.clear();
    setSharedSessionSelectedEngine.mockResolvedValue({ nativeThreadId: "" });
    sendSharedSessionMessage.mockResolvedValue({
      nativeThreadId: "claude:session-1",
      assistantText: "world",
    });
    mockBeginCreating();
    sharedSessionV2CommitTurn.mockResolvedValue({
      status: "committed",
      duplicate: false,
      sequence: 7,
      bindingKey: "claude:profile-1",
    });
    sharedSessionV2MarkRecovery.mockResolvedValue({
      status: "recovery-required",
      bindingKey: "claude:profile-1",
    });
  });

  it("happy path：begin → send（透传 providerProfileId）→ commit completed", async () => {
    const result = await sendSharedSessionTurnV2({ ...BASE_INPUT, target: TARGET });

    // 发送段透传 providerProfileId。
    expect(sendSharedSessionMessage).toHaveBeenCalledWith(
      "ws-1",
      "shared:thread-1",
      "claude",
      "hello",
      expect.objectContaining({ providerProfileId: "profile-1" }),
    );
    // commit 携带 attempt/turn/binding 上下文与 assistantText / nativeSessionId。
    expect(sharedSessionV2CommitTurn).toHaveBeenCalledWith("ws-1", "shared:thread-1", {
      attemptId: "attempt-1",
      logicalTurnId: "turn-1",
      target: expect.objectContaining({
        engine: "claude",
        providerProfileId: "profile-1",
        reasoningEffort: "high",
      }),
      assistantText: "world",
      outcome: { status: "completed" },
      nativeSessionId: "claude:session-1",
    });
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
    expect(sharedSessionV2CommitTurn).not.toHaveBeenCalled();
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
    expect(sharedSessionV2CommitTurn).not.toHaveBeenCalled();
  });

  it("发送抛错且无 negative ACK 证据：进入 recovery，不伪造 failed commit", async () => {
    const sendError = new Error("runtime disconnected");
    sendSharedSessionMessage.mockRejectedValue(sendError);

    await expect(
      sendSharedSessionTurnV2({ ...BASE_INPUT, target: TARGET }),
    ).rejects.toBe(sendError);

    expect(sharedSessionV2CommitTurn).not.toHaveBeenCalled();
    expect(sharedSessionV2MarkRecovery).toHaveBeenCalledWith(
      "ws-1",
      "shared:thread-1",
      {
        bindingKey: "claude:profile-1",
        engine: "claude",
        providerProfileId: "profile-1",
        reason: "runtime-delivery-ambiguous: runtime disconnected",
      },
    );
    expect(getSharedSendState("ws-1", "shared:thread-1").state).toBe(
      "recovery-required",
    );
    expect(getSharedTargetState("ws-1", "shared:thread-1").activeTurnTarget).toBeNull();
  });

  it("发送错误的 recovery 落盘失败时仍保留 recovery UI 并抛原错误", async () => {
    const sendError = new Error("runtime timeout");
    sendSharedSessionMessage.mockRejectedValue(sendError);
    sharedSessionV2MarkRecovery.mockRejectedValue(new Error("event log unavailable"));

    await expect(
      sendSharedSessionTurnV2({ ...BASE_INPUT, target: TARGET }),
    ).rejects.toBe(sendError);

    expect(sharedSessionV2CommitTurn).not.toHaveBeenCalled();
    expect(getSharedSendState("ws-1", "shared:thread-1").state).toBe(
      "recovery-required",
    );
    expect(sharedSessionV2MarkRecovery).toHaveBeenCalledWith(
      "ws-1",
      "shared:thread-1",
      expect.objectContaining({
        reason: "runtime-delivery-ambiguous: runtime timeout",
      }),
    );
    expect(getSharedTargetState("ws-1", "shared:thread-1").activeTurnTarget).toBeNull();
  });

  it("发送成功但 commit 失败（ambiguous）：mark_recovery(commit-failed) + 抛出 + endTurn", async () => {
    const commitError = new Error("event log unavailable");
    sharedSessionV2CommitTurn.mockRejectedValue(commitError);

    await expect(
      sendSharedSessionTurnV2({ ...BASE_INPUT, target: TARGET }),
    ).rejects.toBe(commitError);

    expect(sharedSessionV2MarkRecovery).toHaveBeenCalledWith("ws-1", "shared:thread-1", {
      bindingKey: "claude:profile-1",
      engine: "claude",
      providerProfileId: "profile-1",
      reason: "commit-failed",
    });
    expect(getSharedTargetState("ws-1", "shared:thread-1").activeTurnTarget).toBeNull();
  });
});
