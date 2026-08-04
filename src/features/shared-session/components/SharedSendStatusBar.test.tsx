// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  dispatchSharedSendEvent,
  getSharedSendState,
  resetSharedSendStateStoreForTests,
} from "../runtime/sharedSendStateStore";
import { resetSharedSessionAttemptReattachmentsForTests } from "../runtime/reattachSharedSessionAttempt";
import {
  getSharedTargetState,
  resetSharedTargetStoreForTests,
} from "../target/targetStore";
import { SharedSendStatusBar } from "./SharedSendStatusBar";

const mockServices = vi.hoisted(() => ({
  pushErrorToast: vi.fn(),
  sharedSessionV2TurnState: vi.fn(),
  sharedSessionV2ProbeBinding: vi.fn(),
  sharedSessionV2RecoverAttempt: vi.fn(),
  sharedSessionV2RebuildBinding: vi.fn(),
  sharedSessionV2InterruptTurn: vi.fn(),
  sharedSessionV2AbandonUnresolvedAttempt: vi.fn(),
  sharedSessionV2AwaitTurnTerminal: vi.fn(),
  registerSharedSessionNativeBinding: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const values = Object.values(params ?? {});
      return values.length ? `${key}:${values.join(":")}` : key;
    },
  }),
}));

vi.mock("../runtime/sharedV2SendFlag", () => ({
  isSharedV2SendEnabled: () => true,
}));

vi.mock("../../../services/toasts", () => ({
  pushErrorToast: mockServices.pushErrorToast,
}));

vi.mock("../services/sharedSessions", () => ({
  sharedSessionV2TurnState: mockServices.sharedSessionV2TurnState,
  sharedSessionV2ProbeBinding: mockServices.sharedSessionV2ProbeBinding,
  sharedSessionV2RecoverAttempt: mockServices.sharedSessionV2RecoverAttempt,
  sharedSessionV2RebuildBinding: mockServices.sharedSessionV2RebuildBinding,
  sharedSessionV2InterruptTurn: mockServices.sharedSessionV2InterruptTurn,
  sharedSessionV2AbandonUnresolvedAttempt:
    mockServices.sharedSessionV2AbandonUnresolvedAttempt,
  sharedSessionV2AwaitTurnTerminal:
    mockServices.sharedSessionV2AwaitTurnTerminal,
}));

vi.mock("../runtime/sharedRecoveryExitFlag", () => ({
  isSharedRecoveryExitV2Enabled: () => true,
}));

vi.mock("../runtime/sharedSessionBridge", () => ({
  registerSharedSessionNativeBinding:
    mockServices.registerSharedSessionNativeBinding,
}));

const WS = "ws-1";
const THREAD = "shared-thread-1";

function renderBar() {
  return render(
    <SharedSendStatusBar workspaceId={WS} threadId={THREAD} isSharedSession />,
  );
}

beforeEach(() => {
  resetSharedSendStateStoreForTests();
  resetSharedTargetStoreForTests();
  resetSharedSessionAttemptReattachmentsForTests();
  mockServices.pushErrorToast.mockReset();
  mockServices.sharedSessionV2TurnState.mockReset();
  mockServices.sharedSessionV2ProbeBinding.mockReset();
  mockServices.sharedSessionV2RecoverAttempt.mockReset();
  mockServices.sharedSessionV2RebuildBinding.mockReset();
  mockServices.sharedSessionV2InterruptTurn.mockReset();
  mockServices.sharedSessionV2AbandonUnresolvedAttempt.mockReset();
  mockServices.sharedSessionV2AwaitTurnTerminal.mockReset();
  mockServices.registerSharedSessionNativeBinding.mockReset();
  mockServices.registerSharedSessionNativeBinding.mockReturnValue(true);
  vi.stubGlobal("confirm", vi.fn(() => true));
});

afterEach(() => {
  cleanup();
});

describe("SharedSendStatusBar", () => {
  it("idle 状态不渲染", () => {
    const { container } = renderBar();
    expect(container.firstChild).toBeNull();
  });

  it("V2 flag 关闭时不渲染", async () => {
    const flag = await import("../runtime/sharedV2SendFlag");
    const spy = vi.spyOn(flag, "isSharedV2SendEnabled").mockReturnValue(false);
    dispatchSharedSendEvent(WS, THREAD, { type: "send" });
    const { container } = renderBar();
    expect(container.firstChild).toBeNull();
    spy.mockRestore();
  });

  it("degraded-context 不渲染继续或取消确认", () => {
    dispatchSharedSendEvent(WS, THREAD, { type: "send" });
    dispatchSharedSendEvent(WS, THREAD, { type: "lossyProjection" }, {
      degradedInfo: { reason: "omissions: 2 files" },
    });
    const { container } = renderBar();

    expect(container.firstChild).toBeNull();
    expect(screen.queryByText("sharedSend.degradedConfirm")).toBeNull();
    expect(screen.queryByText("sharedSend.cancel")).toBeNull();
  });

  it("awaiting-acceptance 的 Cancel 在 capability 不支持时禁用", () => {
    dispatchSharedSendEvent(WS, THREAD, { type: "send" });
    dispatchSharedSendEvent(WS, THREAD, { type: "packagePrepared" });
    renderBar();
    const cancelButton = screen.getByText("sharedSend.cancel");
    expect((cancelButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(cancelButton);
    // 禁用时不应推进到 cancel-pending。
    expect(getSharedSendState(WS, THREAD).state).toBe("awaiting-acceptance");
  });

  it("target-unavailable 展示原因", () => {
    dispatchSharedSendEvent(WS, THREAD, { type: "send" });
    dispatchSharedSendEvent(WS, THREAD, { type: "targetUnavailable" }, {
      detail: "provider removed",
    });
    renderBar();
    expect(screen.getByTestId("shared-send-status").textContent).toContain(
      "sharedSend.targetUnavailableReason:provider removed",
    );
  });

  it("recovery-required：Probe 无待处理 Attempt 后解锁", async () => {
    dispatchSharedSendEvent(WS, THREAD, { type: "send" });
    dispatchSharedSendEvent(WS, THREAD, { type: "packagePrepared" });
    dispatchSharedSendEvent(WS, THREAD, { type: "ackAmbiguous" });
    mockServices.sharedSessionV2TurnState.mockResolvedValue({
      status: "ok",
      inFlightAttempts: [],
      bindings: [],
    });
    renderBar();
    fireEvent.click(screen.getByText("sharedSend.recoveryProbe"));
    await waitFor(() => {
      expect(getSharedSendState(WS, THREAD).state).toBe("idle");
    });
  });

  it("recovery-required：Probe 发现已接受未落账 Attempt 时保持锁定", async () => {
    dispatchSharedSendEvent(WS, THREAD, { type: "send" });
    dispatchSharedSendEvent(WS, THREAD, { type: "packagePrepared" });
    dispatchSharedSendEvent(WS, THREAD, { type: "ackAmbiguous" });
    mockServices.sharedSessionV2TurnState.mockResolvedValue({
      status: "ok",
      inFlightAttempts: [],
      bindings: [
        {
          bindingKey: "claude:default",
          provisioningState: "recovery-required",
          availability: "available",
        },
      ],
    });
    mockServices.sharedSessionV2ProbeBinding.mockResolvedValue({
      status: "ok",
      provisioningState: "recovery-required",
      nativeProbe: { status: "matched" },
      inFlightAttempts: [{ attemptId: "a1", logicalTurnId: "t1", accepted: true }],
    });
    mockServices.sharedSessionV2RecoverAttempt.mockResolvedValue({
      status: "unknown",
      attemptId: "a1",
      bindingKey: "claude:default",
    });
    renderBar();
    fireEvent.click(screen.getByText("sharedSend.recoveryProbe"));
    await waitFor(() => {
      expect(screen.getByTestId("shared-send-status").textContent).toContain(
        "sharedSend.recoveryProbeHeld",
      );
    });
    expect(mockServices.sharedSessionV2ProbeBinding).toHaveBeenCalledWith(
      WS,
      THREAD,
      "claude:default",
    );
    expect(mockServices.sharedSessionV2RecoverAttempt).toHaveBeenCalledWith(
      WS,
      THREAD,
      "a1",
    );
    expect(getSharedSendState(WS, THREAD).state).toBe("recovery-required");
  });

  it("recovery-required：Probe 按 durable Attempt owner 恢复 active run", async () => {
    dispatchSharedSendEvent(WS, THREAD, { type: "send" });
    dispatchSharedSendEvent(WS, THREAD, { type: "packagePrepared" });
    dispatchSharedSendEvent(WS, THREAD, { type: "ackAmbiguous" });
    mockServices.sharedSessionV2TurnState.mockResolvedValue({
      status: "ok",
      inFlightAttempts: [
        {
          attemptId: "attempt-active",
          bindingKey: "codex:provider-a",
          accepted: true,
        },
      ],
      bindings: [],
    });
    mockServices.sharedSessionV2RecoverAttempt.mockResolvedValue({
      status: "active",
      attemptId: "attempt-active",
      bindingKey: "codex:provider-a",
      nativeThreadId: "native-active",
      runtimeTurnId: "runtime-active",
      executionTargetSnapshot: {
        engine: "codex",
        providerProfileId: "provider-a",
        modelCatalogEntryId: "catalog-gpt-5",
        model: "gpt-5",
        reasoning: { effort: "high" },
        providerProfileNameSnapshot: "Provider A",
        providerProfileSource: "managed",
        runtimeCapabilityFingerprint: null,
      },
    });
    mockServices.sharedSessionV2AwaitTurnTerminal.mockReturnValue(
      new Promise(() => undefined),
    );

    renderBar();
    fireEvent.click(screen.getByText("sharedSend.recoveryProbe"));
    await waitFor(() => {
      expect(getSharedSendState(WS, THREAD).state).toBe("running");
    });
    expect(mockServices.sharedSessionV2RecoverAttempt).toHaveBeenCalledWith(
      WS,
      THREAD,
      "attempt-active",
    );
    expect(mockServices.sharedSessionV2ProbeBinding).not.toHaveBeenCalled();
    expect(mockServices.sharedSessionV2AwaitTurnTerminal).toHaveBeenCalledWith(
      WS,
      THREAD,
      "attempt-active",
    );
    expect(getSharedTargetState(WS, THREAD).activeTurnTarget).toMatchObject({
      engine: "codex",
      model: "gpt-5",
    });
  });

  it("Probe(active) 后 terminal 要求 Binding recovery：卡片保持 held", async () => {
    dispatchSharedSendEvent(WS, THREAD, { type: "send" });
    dispatchSharedSendEvent(WS, THREAD, { type: "packagePrepared" });
    dispatchSharedSendEvent(WS, THREAD, { type: "ackAmbiguous" });
    mockServices.sharedSessionV2TurnState.mockResolvedValue({
      status: "ok",
      inFlightAttempts: [
        {
          attemptId: "attempt-missing-native",
          bindingKey: "codex:provider-a",
          accepted: true,
        },
      ],
      bindings: [],
    });
    mockServices.sharedSessionV2RecoverAttempt.mockResolvedValue({
      status: "active",
      attemptId: "attempt-missing-native",
      bindingKey: "codex:provider-a",
      nativeThreadId: "native-missing",
      runtimeTurnId: "runtime-missing",
      executionTargetSnapshot: {
        engine: "codex",
        providerProfileId: "provider-a",
        modelCatalogEntryId: "catalog-gpt-5",
        model: "gpt-5",
        reasoning: { effort: "high" },
        providerProfileNameSnapshot: "Provider A",
        providerProfileSource: "managed",
        runtimeCapabilityFingerprint: null,
      },
    });
    mockServices.sharedSessionV2AwaitTurnTerminal.mockResolvedValue({
      status: "committed",
      duplicate: false,
      sequence: 19,
      bindingKey: "codex:provider-a",
      terminal: {
        type: "run.settled",
        outcome: "failed",
        recoveryReason: "native-session-not-found",
      },
    });

    renderBar();
    fireEvent.click(screen.getByText("sharedSend.recoveryProbe"));

    await waitFor(() => {
      expect(getSharedSendState(WS, THREAD).state).toBe(
        "recovery-required",
      );
      expect(screen.getByTestId("shared-send-status").textContent).toContain(
        "sharedSend.recoveryProbeHeld",
      );
    });
  });

  it("recovery-required：Probe 失败保持锁定并显示错误", async () => {
    dispatchSharedSendEvent(WS, THREAD, { type: "send" });
    dispatchSharedSendEvent(WS, THREAD, { type: "packagePrepared" });
    dispatchSharedSendEvent(WS, THREAD, { type: "ackAmbiguous" });
    mockServices.sharedSessionV2TurnState.mockRejectedValue(
      new Error("probe unavailable"),
    );

    renderBar();
    fireEvent.click(screen.getByText("sharedSend.recoveryProbe"));
    await waitFor(() => {
      expect(mockServices.pushErrorToast).toHaveBeenCalledWith({
        title: "sharedSend.recoveryTitle",
        message: "sharedSend.recoveryProbe: probe unavailable",
        durationMs: 4800,
      });
    });
    expect(getSharedSendState(WS, THREAD).state).toBe("recovery-required");
    expect(screen.getByTestId("shared-send-status").textContent).toContain(
      "sharedSend.recoveryProbeHeld",
    );
  });

  it("recovery-required：停止并重建调用 rebuild 并解锁", async () => {
    dispatchSharedSendEvent(WS, THREAD, { type: "send" });
    dispatchSharedSendEvent(WS, THREAD, { type: "packagePrepared" });
    dispatchSharedSendEvent(WS, THREAD, { type: "ackAmbiguous" });
    mockServices.sharedSessionV2TurnState.mockResolvedValue({
      status: "ok",
      inFlightAttempts: [],
      bindings: [
        {
          bindingKey: "codex:prov-1",
          provisioningState: "recovery-required",
          availability: "available",
        },
      ],
    });
    mockServices.sharedSessionV2RebuildBinding.mockResolvedValue({
      status: "prepared",
      bindingKey: "codex:prov-1",
      nativeThreadId: "native-1",
    });
    renderBar();
    fireEvent.click(screen.getByText("sharedSend.recoveryStopAndRebuild"));
    await waitFor(() => {
      expect(getSharedSendState(WS, THREAD).state).toBe("idle");
    });
    expect(mockServices.sharedSessionV2RebuildBinding).toHaveBeenCalledWith(
      WS,
      THREAD,
      "codex:prov-1",
    );
  });

  it("recovery-required：停止并重建在 Runtime own 时先 interrupt", async () => {
    dispatchSharedSendEvent(WS, THREAD, { type: "send" });
    dispatchSharedSendEvent(WS, THREAD, { type: "packagePrepared" });
    dispatchSharedSendEvent(WS, THREAD, { type: "ackAmbiguous" });
    mockServices.sharedSessionV2TurnState.mockResolvedValue({
      status: "ok",
      inFlightAttempts: [
        {
          attemptId: "attempt-owned",
          bindingKey: "codex:prov-1",
          accepted: true,
        },
      ],
      bindings: [],
    });
    mockServices.sharedSessionV2InterruptTurn.mockResolvedValue({
      status: "interrupted",
      attemptId: "attempt-owned",
      engine: "codex",
      bindingKey: "codex:prov-1",
      nativeThreadId: "native-1",
      runtimeTurnId: "run-1",
    });
    mockServices.sharedSessionV2RebuildBinding.mockResolvedValue({
      status: "prepared",
      bindingKey: "codex:prov-1",
    });
    renderBar();
    fireEvent.click(screen.getByText("sharedSend.recoveryStopAndRebuild"));
    await waitFor(() => {
      expect(getSharedSendState(WS, THREAD).state).toBe("idle");
    });
    expect(mockServices.sharedSessionV2InterruptTurn).toHaveBeenCalledWith(
      WS,
      THREAD,
      "attempt-owned",
    );
    expect(mockServices.sharedSessionV2RebuildBinding).toHaveBeenCalledWith(
      WS,
      THREAD,
      "codex:prov-1",
    );
  });

  it("recovery-required：停止并重建失败保持锁定并映射可操作错误", async () => {
    dispatchSharedSendEvent(WS, THREAD, { type: "send" });
    dispatchSharedSendEvent(WS, THREAD, { type: "packagePrepared" });
    dispatchSharedSendEvent(WS, THREAD, { type: "ackAmbiguous" });
    mockServices.sharedSessionV2TurnState.mockResolvedValue({
      status: "ok",
      inFlightAttempts: [],
      bindings: [
        {
          bindingKey: "codex:prov-1",
          provisioningState: "recovery-required",
          availability: "available",
        },
      ],
    });
    mockServices.sharedSessionV2RebuildBinding.mockRejectedValue(
      new Error(
        "recovery-active: attempt a1 is still owned by Runtime; Probe/Stop before rebuild",
      ),
    );

    renderBar();
    fireEvent.click(screen.getByText("sharedSend.recoveryStopAndRebuild"));
    await waitFor(() => {
      expect(mockServices.pushErrorToast).toHaveBeenCalledWith({
        title: "sharedSend.recoveryTitle",
        message: "sharedSend.recoveryErrorActive",
        durationMs: 5200,
      });
    });
    expect(getSharedSendState(WS, THREAD).state).toBe("recovery-required");
  });

  it("recovery-required：放弃本轮 durable cancel 后解锁", async () => {
    dispatchSharedSendEvent(WS, THREAD, { type: "send" });
    dispatchSharedSendEvent(WS, THREAD, { type: "packagePrepared" });
    dispatchSharedSendEvent(WS, THREAD, { type: "ackAmbiguous" });
    mockServices.sharedSessionV2TurnState.mockResolvedValue({
      status: "ok",
      inFlightAttempts: [
        {
          attemptId: "attempt-abandon",
          bindingKey: "codex:prov-1",
          accepted: false,
        },
      ],
      bindings: [],
    });
    mockServices.sharedSessionV2AbandonUnresolvedAttempt.mockResolvedValue({
      status: "cancelled-committed",
      attemptId: "attempt-abandon",
      bindingKey: "codex:prov-1",
      sequence: 9,
    });
    renderBar();
    fireEvent.click(screen.getByText("sharedSend.recoveryAbandon"));
    await waitFor(() => {
      expect(getSharedSendState(WS, THREAD).state).toBe("idle");
    });
    expect(
      mockServices.sharedSessionV2AbandonUnresolvedAttempt,
    ).toHaveBeenCalledWith(WS, THREAD, {
      attemptId: "attempt-abandon",
      forceStop: true,
    });
  });

  it("target-unavailable 引导更换目标", () => {
    dispatchSharedSendEvent(WS, THREAD, { type: "send" });
    dispatchSharedSendEvent(WS, THREAD, { type: "targetUnavailable" }, {
      detail: "missing provider",
    });
    renderBar();
    const text = screen.getByTestId("shared-send-status").textContent ?? "";
    expect(text).toContain("sharedSend.targetUnavailableReason");
    expect(text).toContain("sharedSend.targetUnavailableHint");
  });
});
