// @vitest-environment jsdom
//
// 04 号清单「自动监考：流式压测门禁」Task 1 —— 10 万思考电报压测。
//
// 预算口径（照抄丝滑项目 deepseek-harness/apps/web/stress-tests/reasoning-chunks.stress.ts:13-16）：
//   CHUNK_COUNT = 100_000、CHUNKS_PER_INTERVAL = 128、CHUNK_INTERVAL_MS = 16、
//   MAIN_THREAD_DELAY_BUDGET_MS = 250。
// 断言两条：
//   ① 最大 event-loop lag 严格 < 250ms（同时记 P95；跑 3 次取中位防 jsdom 抖动）；
//   ② 根 dispatch 次数有界（10 万 chunk 走专线后是「建壳 + settle drain」的回合级
//      次数，上界 ROOT_DISPATCH_BOUND；谁把「逐 delta 打根」写回来，这里立刻变红）。
//
// 挂载方式照 01 号清单的现成模板
//（src/features/threads/hooks/useThreadItemEvents.liveDeltaDispatchCount.test.ts）：
// 真实 useThreadItemEvents hook + vi.fn() 根 dispatch 计数 + localStorage 强制
// flag（useThreadItemEvents 在模块加载时读一次 flag，故 import 前设好并
// vi.resetModules() 后动态 import）。
//
// 关键差异：本测试全程真实计时器。fake timers 下沉睡式注入测不到真实 event-loop
// lag——注入循环由真实 setInterval(16ms) 驱动，lag 探针是真实 setInterval(50ms)
// 的期望 vs 实际漂移（knife 实验 §2.2 同款探针，见
// docs/perf/render-jank-knife-experiments-2026-07-08.md）。
//
// 诚实标注：jsdom 没有真实 layout/paint，这道门守的是「打根次数 + 主线程任务
// 时长」；浏览器里的绘制卡顿仍靠 03/05 号清单的手动 Profiler 验收兜底。
//
// Task 3 反例验证记录（2026-08-14，改动已还原、未入库）：
// - 反例：loadHook 内临时把 ccgui.perf.liveDeltaExternalization 置 "0"（关专线、
//   逐 delta 经 32ms 批量直接打根），跑 npm run perf:streaming:stress → 变红：
//   round=1 rootDispatch=100391，断言「根 dispatch 必须有界」失败
//   （expected 100391 to be less than or equal to 50）。
// - 还原后复跑 → 变绿：三轮 rootDispatch=3，lagMax 中位 45.4ms < 250ms。
// - 注：dispatch 是 vi.fn() 计数桩，反例下 lag 不升（4.7ms）属预期——这道门对
//   「逐 delta 打根」回归的拦截齿是断言②（dispatch 有界），断言①守入口链路
//   自身的主线程任务时长。
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const CHUNK_COUNT = 100_000;
const CHUNKS_PER_INTERVAL = 128;
const CHUNK_INTERVAL_MS = 16;
const MAIN_THREAD_DELAY_BUDGET_MS = 250;
const STRESS_RUNS = 3;
const LAG_PROBE_INTERVAL_MS = 50;
// 专线开启时根 dispatch = 每 lane 建壳 1 次 + settle drain 1 次（本场景单 lane ≈ 3 次，
// 含 ensureThread）。上界留足实现演进余量，但远低于「逐 delta 打根」的十万量级。
const ROOT_DISPATCH_BOUND = 50;

const THREAD_ID = "claude:stress-reasoning";
const WORKSPACE_ID = "ws-stress";
const REASONING_ITEM_ID = `${THREAD_ID}:reasoning:turn-1`;

async function loadHook() {
  vi.resetModules();
  window.localStorage.clear();
  window.localStorage.setItem("ccgui.perf.realtimeBatching", "1");
  window.localStorage.setItem("ccgui.perf.liveDeltaExternalization", "1");
  const mod = await import("../hooks/useThreadItemEvents");
  return mod.useThreadItemEvents;
}

function mountHook(useThreadItemEvents: Awaited<ReturnType<typeof loadHook>>) {
  const dispatch = vi.fn();
  const { result, unmount } = renderHook(() =>
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
  return { result, dispatch, unmount };
}

/** knife 实验 §2.2 同款 event-loop lag 探针：期望间隔 vs 实际间隔的漂移。 */
function startEventLoopLagProbe(intervalMs = LAG_PROBE_INTERVAL_MS) {
  const samples: number[] = [];
  let lastTickAt = performance.now();
  const intervalId = setInterval(() => {
    const now = performance.now();
    samples.push(Math.max(0, now - lastTickAt - intervalMs));
    lastTickAt = now;
  }, intervalMs);
  return {
    samples,
    stop: () => clearInterval(intervalId),
  };
}

function percentileNearestRank(sortedSamples: number[], percentile: number): number {
  if (sortedSamples.length === 0) {
    return 0;
  }
  const index = Math.min(
    sortedSamples.length - 1,
    Math.floor((percentile / 100) * sortedSamples.length),
  );
  return sortedSamples[index];
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

type StressRoundReport = {
  emitted: number;
  maxLagMs: number;
  p95LagMs: number;
  lagSamples: number;
  rootDispatchCount: number;
  wallMs: number;
};

async function runStressRound(): Promise<StressRoundReport> {
  const useThreadItemEvents = await loadHook();
  const { result, dispatch, unmount } = mountHook(useThreadItemEvents);
  const probe = startEventLoopLagProbe();
  const startedAt = performance.now();
  let emitted = 0;

  try {
    await new Promise<void>((resolve, reject) => {
      const intervalId = setInterval(() => {
        try {
          act(() => {
            const batchEnd = Math.min(emitted + CHUNKS_PER_INTERVAL, CHUNK_COUNT);
            for (; emitted < batchEnd; emitted += 1) {
              result.current.onReasoningTextDelta(
                WORKSPACE_ID,
                THREAD_ID,
                REASONING_ITEM_ID,
                `推理片段 ${emitted}。`,
              );
            }
          });
          if (emitted >= CHUNK_COUNT) {
            clearInterval(intervalId);
            resolve();
          }
        } catch (error) {
          clearInterval(intervalId);
          reject(error);
        }
      }, CHUNK_INTERVAL_MS);
    });

    // turn settle：先收敛批量队列，再 drain 通道尾部落回根（专线收尾路径）。
    act(() => {
      result.current.flushPendingRealtimeEvents();
      result.current.drainLiveItemDeltasForThread(THREAD_ID);
    });
  } finally {
    probe.stop();
    unmount();
  }

  const wallMs = performance.now() - startedAt;
  const sortedSamples = [...probe.samples].sort((a, b) => a - b);
  return {
    emitted,
    maxLagMs: sortedSamples[sortedSamples.length - 1] ?? 0,
    p95LagMs: percentileNearestRank(sortedSamples, 95),
    lagSamples: probe.samples.length,
    rootDispatchCount: dispatch.mock.calls.length,
    wallMs,
  };
}

describe("04 号清单 · 流式压测门禁：100,000 个思考电报", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.useRealTimers();
  });

  it(
    "以 128/16ms 节奏灌 10 万 chunk：event-loop lag 中位严格 < 250ms 且根 dispatch 有界",
    async () => {
      const rounds: StressRoundReport[] = [];
      for (let round = 0; round < STRESS_RUNS; round += 1) {
        rounds.push(await runStressRound());
      }

      let totalWallMs = 0;
      for (const [index, report] of rounds.entries()) {
        totalWallMs += report.wallMs;
        console.log(
          `[streaming-stress] round=${index + 1} emitted=${report.emitted} ` +
            `lagMax=${report.maxLagMs.toFixed(1)}ms lagP95=${report.p95LagMs.toFixed(1)}ms ` +
            `lagSamples=${report.lagSamples} rootDispatch=${report.rootDispatchCount} ` +
            `wall=${(report.wallMs / 1000).toFixed(1)}s`,
        );
        expect(report.emitted).toBe(CHUNK_COUNT);
        expect(report.lagSamples).toBeGreaterThan(0);
        // 断言②：根 dispatch 有界（回合级次数，不随 chunk 数线性增长）。
        expect(
          report.rootDispatchCount,
          `round ${index + 1} 根 dispatch 必须有界（逐 delta 打根回归拦截）`,
        ).toBeLessThanOrEqual(ROOT_DISPATCH_BOUND);
      }

      const medianMaxLagMs = median(rounds.map((report) => report.maxLagMs));
      const medianP95LagMs = median(rounds.map((report) => report.p95LagMs));
      console.log(
        `[streaming-stress] median lagMax=${medianMaxLagMs.toFixed(1)}ms ` +
          `lagP95=${medianP95LagMs.toFixed(1)}ms totalWall=${(totalWallMs / 1000).toFixed(1)}s ` +
          `budget=${MAIN_THREAD_DELAY_BUDGET_MS}ms`,
      );

      // 断言①：三轮中位的最大 event-loop lag 严格 < 250ms（P95 同口径记录）。
      expect(
        medianMaxLagMs,
        `event-loop lag 中位 ${medianMaxLagMs.toFixed(1)}ms 超出预算 ${MAIN_THREAD_DELAY_BUDGET_MS}ms`,
      ).toBeLessThan(MAIN_THREAD_DELAY_BUDGET_MS);
      expect(medianP95LagMs).toBeLessThan(MAIN_THREAD_DELAY_BUDGET_MS);
    },
    300_000,
  );
});
