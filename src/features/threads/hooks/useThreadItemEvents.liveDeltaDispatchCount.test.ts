// @vitest-environment jsdom
//
// Task 5.5 实测：长思考回合中「根 dispatch 次数」改前（liveDeltaExternalization
// 关）vs 改后（开）的对比测量。
//
// 测量方法：
// - 真实 useThreadItemEvents hook（renderHook）+ vi.fn() 根 dispatch 计数；
// - realtimeBatching 强制开（生产默认开），模拟 32ms 批量队列；
// - 一回合 225 条电报（150 reasoningContent + 25 reasoningSummary + 50
//   toolOutput，10ms 间隔 ≈ 峰值 100+ 条/秒，覆盖 ~30 条/秒场景）；
// - flag 通过 localStorage 预设 + vi.resetModules 后动态 import 生效
// （useThreadItemEvents 在模块加载时读一次 flag）。
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const THREAD_ID = "claude:session-1";
const WORKSPACE_ID = "ws-1";

async function loadHook(liveDeltaEnabled: boolean) {
  vi.resetModules();
  window.localStorage.clear();
  window.localStorage.setItem("ccgui.perf.realtimeBatching", "1");
  if (liveDeltaEnabled) {
    window.localStorage.setItem("ccgui.perf.liveDeltaExternalization", "1");
  }
  const mod = await import("./useThreadItemEvents");
  return mod.useThreadItemEvents;
}

function mountHook(useThreadItemEvents: Awaited<ReturnType<typeof loadHook>>) {
  const dispatch = vi.fn();
  const { result } = renderHook(() =>
    useThreadItemEvents({
      activeThreadId: THREAD_ID,
      dispatch,
      getCustomName: vi.fn(() => undefined),
      markProcessing: vi.fn(),
      markReviewing: vi.fn(),
      safeMessageActivity: vi.fn(),
      recordThreadActivity: vi.fn(),
      applyCollabThreadLinks: vi.fn(),
      interruptedThreadsRef: { current: new Map<string, Map<string, true>>() },
    }),
  );
  return { result, dispatch };
}

function driveLongReasoningTurn(
  result: ReturnType<typeof mountHook>["result"],
) {
  act(() => {
    for (let index = 0; index < 150; index += 1) {
      result.current.onReasoningTextDelta(
        WORKSPACE_ID,
        THREAD_ID,
        "reasoning-1",
        `推理片段 ${index}。`,
      );
      if (index % 6 === 0) {
        result.current.onReasoningSummaryDelta(
          WORKSPACE_ID,
          THREAD_ID,
          "reasoning-1",
          `摘要 ${index}。`,
        );
      }
      if (index % 3 === 2) {
        result.current.onCommandOutputDelta(
          WORKSPACE_ID,
          THREAD_ID,
          "tool-1",
          `output-${index}\n`,
        );
      }
      vi.advanceTimersByTime(10);
    }
    // tool output tail gate 的 trailing flush（32ms cadence）。
    vi.advanceTimersByTime(100);
    // turn settle：先收敛排队内容，再 drain 通道尾段（flag 关时 drain 为 no-op）。
    result.current.flushPendingRealtimeEvents();
    result.current.drainLiveItemDeltasForThread(THREAD_ID);
  });
}

describe("Task 5.5 实测：长思考回合根 dispatch 次数（改前 vs 改后）", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.useRealTimers();
  });

  it("flag 开时根 dispatch 降到回合级", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });

    const hookFlagOff = await loadHook(false);
    const flagOff = mountHook(hookFlagOff);
    driveLongReasoningTurn(flagOff.result);
    const dispatchCountFlagOff = flagOff.dispatch.mock.calls.length;

    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });

    const hookFlagOn = await loadHook(true);
    const flagOn = mountHook(hookFlagOn);
    driveLongReasoningTurn(flagOn.result);
    const dispatchCountFlagOn = flagOn.dispatch.mock.calls.length;

    // 实测记录（Task 5.5 验收数字）：
    console.log(
      `[perf-measure] 长思考回合根 dispatch 次数：改前(flag关)=${dispatchCountFlagOff}，改后(flag开)=${dispatchCountFlagOn}`,
    );

    // 改前：每条 delta 都经 32ms 批量打根（百次级）；改后：每 lane 建壳 +
    // settle drain（十次以内）。
    expect(dispatchCountFlagOff).toBeGreaterThan(200);
    expect(dispatchCountFlagOn).toBeLessThanOrEqual(20);
    expect(dispatchCountFlagOn / dispatchCountFlagOff).toBeLessThan(0.1);
  });
});
