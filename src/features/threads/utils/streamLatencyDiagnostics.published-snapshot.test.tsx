// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentClaudeConfig: vi.fn(),
  appendRendererDiagnostic: vi.fn(),
  isWindowsPlatform: vi.fn(),
  isMacPlatform: vi.fn(),
}));

vi.mock("../../../services/tauri", () => ({
  getCurrentClaudeConfig: mocks.getCurrentClaudeConfig,
}));

vi.mock("../../../services/rendererDiagnostics", () => ({
  appendRendererDiagnostic: mocks.appendRendererDiagnostic,
}));

vi.mock("../../../utils/platform", () => ({
  isWindowsPlatform: mocks.isWindowsPlatform,
  isMacPlatform: mocks.isMacPlatform,
}));

import {
  noteThreadTextIngressReceived,
  noteThreadTurnStarted,
  reportThreadUpstreamPending,
  resetThreadStreamLatencyDiagnosticsForTests,
  useThreadStreamLatencySnapshot,
} from "./streamLatencyDiagnostics";

const THREAD_ID = "thread-published-snapshot";

function ingress(textLength: number) {
  noteThreadTextIngressReceived(THREAD_ID, {
    source: "delta",
    itemId: "assistant-1",
    textLength,
  });
}

// 回归锁：useSyncExternalStore 的 getSnapshot 必须只在可观察字段
// （latencyCategory / mitigation）变化时更换引用。曾经它直接暴露内部快照，
// 流式期每个 delta 都换引用，React 渲染一致性检查连环强制同步重渲染，
// 双会话高频流式下触发 Maximum update depth (#185) 白屏。
describe("useThreadStreamLatencySnapshot published snapshot", () => {
  beforeEach(() => {
    mocks.getCurrentClaudeConfig.mockReset();
    mocks.appendRendererDiagnostic.mockReset();
    mocks.isWindowsPlatform.mockReset();
    mocks.isMacPlatform.mockReset();
    mocks.isWindowsPlatform.mockReturnValue(false);
    mocks.isMacPlatform.mockReturnValue(false);
    resetThreadStreamLatencyDiagnosticsForTests();
  });

  afterEach(() => {
    cleanup();
    resetThreadStreamLatencyDiagnosticsForTests();
  });

  it("stays null while only non-observable fields change", () => {
    const { result } = renderHook(() =>
      useThreadStreamLatencySnapshot(THREAD_ID),
    );
    expect(result.current).toBeNull();

    act(() => {
      noteThreadTurnStarted({
        workspaceId: "ws-1",
        threadId: THREAD_ID,
        turnId: "turn-1",
        startedAt: 1_000,
      });
      ingress(10);
      ingress(40);
      ingress(90);
    });

    expect(result.current).toBeNull();
  });

  it("keeps the same snapshot reference across streaming ingress after publication", () => {
    const { result } = renderHook(() =>
      useThreadStreamLatencySnapshot(THREAD_ID),
    );

    act(() => {
      noteThreadTurnStarted({
        workspaceId: "ws-1",
        threadId: THREAD_ID,
        turnId: "turn-1",
        startedAt: 1_000,
      });
      reportThreadUpstreamPending(THREAD_ID);
    });

    const published = result.current;
    expect(published?.latencyCategory).toBe("upstream-pending");

    act(() => {
      ingress(10);
      ingress(40);
      ingress(90);
      ingress(200);
    });

    expect(result.current).toBe(published);
  });
});
