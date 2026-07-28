// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  dispatchSharedSendEvent,
  getSharedSendState,
  resetSharedSendStateStoreForTests,
} from "../runtime/sharedSendStateStore";
import { SharedSendStatusBar } from "./SharedSendStatusBar";

const mockServices = vi.hoisted(() => ({
  pushErrorToast: vi.fn(),
  sharedSessionV2TurnState: vi.fn(),
  sharedSessionV2ProbeBinding: vi.fn(),
  sharedSessionV2RecoverAttempt: vi.fn(),
  sharedSessionV2RebuildBinding: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params?.reason ? `${key}:${String(params.reason)}` : key,
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
  mockServices.pushErrorToast.mockReset();
  mockServices.sharedSessionV2TurnState.mockReset();
  mockServices.sharedSessionV2ProbeBinding.mockReset();
  mockServices.sharedSessionV2RecoverAttempt.mockReset();
  mockServices.sharedSessionV2RebuildBinding.mockReset();
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

  it("degraded-context 未经确认保持锁定，确认后推进", () => {
    dispatchSharedSendEvent(WS, THREAD, { type: "send" });
    dispatchSharedSendEvent(WS, THREAD, { type: "lossyProjection" }, {
      degradedInfo: { reason: "omissions: 2 files" },
    });
    renderBar();
    expect(screen.getByTestId("shared-send-status").textContent).toContain(
      "sharedSend.degradedTitle",
    );
    expect(screen.getByTestId("shared-send-status").textContent).toContain(
      "omissions: 2 files",
    );
    // 未确认：状态保持 degraded-context（不会发送）。
    expect(getSharedSendState(WS, THREAD).state).toBe("degraded-context");
    fireEvent.click(screen.getByText("sharedSend.degradedConfirm"));
    expect(getSharedSendState(WS, THREAD).state).toBe("awaiting-acceptance");
  });

  it("degraded-context 取消进入 settling", () => {
    dispatchSharedSendEvent(WS, THREAD, { type: "send" });
    dispatchSharedSendEvent(WS, THREAD, { type: "lossyProjection" });
    renderBar();
    fireEvent.click(screen.getByText("sharedSend.cancel"));
    expect(getSharedSendState(WS, THREAD).state).toBe("settling");
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
    });

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

  it("recovery-required：显式重建调用 rebuild 并解锁", async () => {
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
    fireEvent.click(screen.getByText("sharedSend.recoveryRebuild"));
    await waitFor(() => {
      expect(getSharedSendState(WS, THREAD).state).toBe("idle");
    });
    expect(mockServices.sharedSessionV2RebuildBinding).toHaveBeenCalledWith(
      WS,
      THREAD,
      "codex:prov-1",
    );
  });

  it("recovery-required：显式重建失败保持锁定并显示错误", async () => {
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
      new Error("rebuild rejected"),
    );

    renderBar();
    fireEvent.click(screen.getByText("sharedSend.recoveryRebuild"));
    await waitFor(() => {
      expect(mockServices.pushErrorToast).toHaveBeenCalledWith({
        title: "sharedSend.recoveryTitle",
        message: "sharedSend.recoveryRebuild: rebuild rejected",
        durationMs: 4800,
      });
    });
    expect(getSharedSendState(WS, THREAD).state).toBe("recovery-required");
  });
});
