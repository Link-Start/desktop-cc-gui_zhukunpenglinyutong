// @vitest-environment jsdom
//
// A4 二期 live-delta 外部化的生产侧守卫（liveDeltaExternalization 开启）。
//
// flag 开时 reasoningContent / reasoningSummary / toolOutput 三类 delta：
// - 首条仍 dispatch 原 action 建壳（durable item 存在、key 稳定）；
// - 后续只累积进 liveItemDeltaChannel，不再进根 dispatch；
// - 不再进 32ms 批量队列（通道自带 48ms 节奏）。
// reasoningSummaryBoundary 是边界事件，必须保留原 dispatch。
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  peekLiveItemDelta,
  resetLiveItemDeltaChannelForTests,
} from "../utils/liveItemDeltaChannel";
import { useThreadItemEvents } from "./useThreadItemEvents";

// 该 flag 的 testDefaultValue 为 false；本文件专门验证它开启后的行为。
// useThreadItemEvents 在模块加载时读取一次，故必须在 import 前用 mock 覆盖。
vi.mock("../utils/realtimePerfFlags", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../utils/realtimePerfFlags")
  >();
  return { ...actual, isLiveDeltaExternalizationEnabled: () => true };
});

const THREAD_ID = "claude:session-1";
const WORKSPACE_ID = "ws-1";

const makeHook = () => {
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
};

const dispatchedTypes = (dispatch: ReturnType<typeof vi.fn>) =>
  dispatch.mock.calls.map(([action]) => (action as { type: string }).type);

describe("useThreadItemEvents live-item-delta externalization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.removeItem("ccgui.perf.realtimeBatching");
    resetLiveItemDeltaChannelForTests();
  });

  afterEach(() => {
    resetLiveItemDeltaChannelForTests();
  });

  it("routes reasoning deltas to the channel after the first shell dispatch", () => {
    const { result, dispatch } = makeHook();

    act(() => {
      result.current.onReasoningTextDelta(
        WORKSPACE_ID,
        THREAD_ID,
        "reasoning-1",
        "先",
      );
      result.current.onReasoningTextDelta(
        WORKSPACE_ID,
        THREAD_ID,
        "reasoning-1",
        "后",
      );
      result.current.onReasoningTextDelta(
        WORKSPACE_ID,
        THREAD_ID,
        "reasoning-1",
        "末",
      );
    });

    const types = dispatchedTypes(dispatch);
    // 首条建壳：ensureThread + appendReasoningContent 各一次；后续零根 dispatch。
    expect(
      types.filter((type) => type === "appendReasoningContent"),
    ).toHaveLength(1);
    expect(types.filter((type) => type === "ensureThread")).toHaveLength(1);
    expect(dispatch).toHaveBeenCalledTimes(2);
    // 通道持有全量累积文本（含建壳首段）。
    expect(peekLiveItemDelta(THREAD_ID, "reasoning-1", "reasoningContent")).toBe(
      "先后末",
    );
  });

  it("keeps reasoningSummary and toolOutput lanes on the same contract", () => {
    const { result, dispatch } = makeHook();

    act(() => {
      result.current.onReasoningSummaryDelta(
        WORKSPACE_ID,
        THREAD_ID,
        "reasoning-1",
        "摘要一",
      );
      result.current.onReasoningSummaryDelta(
        WORKSPACE_ID,
        THREAD_ID,
        "reasoning-1",
        "摘要二",
      );
      result.current.onCommandOutputDelta(
        WORKSPACE_ID,
        THREAD_ID,
        "tool-1",
        "output-1",
      );
      result.current.onCommandOutputDelta(
        WORKSPACE_ID,
        THREAD_ID,
        "tool-1",
        "output-2",
      );
      // 通道改道不经 32ms 批量器；toolOutput 仍带 tail gate，需要同步排空。
      result.current.flushPendingRealtimeEvents();
    });

    const types = dispatchedTypes(dispatch);
    expect(
      types.filter((type) => type === "appendReasoningSummary"),
    ).toHaveLength(1);
    // toolOutput 经过 tail gate（其自身 32ms 合批），flush 后同样只建壳一次。
    expect(
      types.filter((type) => type === "appendToolOutput"),
    ).toHaveLength(1);
    expect(peekLiveItemDelta(THREAD_ID, "reasoning-1", "reasoningSummary")).toBe(
      "摘要一摘要二",
    );
    expect(peekLiveItemDelta(THREAD_ID, "tool-1", "toolOutput")).toContain(
      "output-1",
    );
  });

  it("keeps reasoningSummaryBoundary on the original dispatch path", () => {
    const { result, dispatch } = makeHook();

    act(() => {
      result.current.onReasoningSummaryDelta(
        WORKSPACE_ID,
        THREAD_ID,
        "reasoning-1",
        "摘要",
      );
      result.current.onReasoningSummaryBoundary(
        WORKSPACE_ID,
        THREAD_ID,
        "reasoning-1",
      );
    });

    const types = dispatchedTypes(dispatch);
    expect(
      types.filter((type) => type === "appendReasoningSummaryBoundary"),
    ).toHaveLength(1);
  });

  it("drains the lane tail into the reducer when the item completes", () => {
    const { result, dispatch } = makeHook();

    act(() => {
      result.current.onReasoningTextDelta(
        WORKSPACE_ID,
        THREAD_ID,
        "reasoning-1",
        "先",
      );
      result.current.onReasoningTextDelta(
        WORKSPACE_ID,
        THREAD_ID,
        "reasoning-1",
        "后",
      );
    });
    // 流式期间只有建壳首段落 reducer。
    expect(
      dispatchedTypes(dispatch).filter(
        (type) => type === "appendReasoningContent",
      ),
    ).toHaveLength(1);

    act(() => {
      result.current.onItemCompleted(WORKSPACE_ID, THREAD_ID, {
        type: "reasoning",
        id: "reasoning-1",
        summary: "",
        content: "先后",
      });
    });

    // itemCompleted：尾段灌回（merge 层对快照已覆盖部分去重），lane 条目清除。
    const contentDeltas = dispatch.mock.calls
      .map(([action]) => action as Record<string, unknown>)
      .filter((action) => action.type === "appendReasoningContent")
      .map((action) => action.delta);
    expect(contentDeltas).toEqual(["先", "后"]);
    expect(peekLiveItemDelta(THREAD_ID, "reasoning-1", "reasoningContent")).toBe(
      "",
    );

    // turn settle 不再重复灌回同一 lane。
    act(() => {
      result.current.drainLiveItemDeltasForThread(THREAD_ID);
    });
    const contentDeltasAfterTurnDrain = dispatch.mock.calls
      .map(([action]) => action as Record<string, unknown>)
      .filter((action) => action.type === "appendReasoningContent")
      .map((action) => action.delta);
    expect(contentDeltasAfterTurnDrain).toEqual(["先", "后"]);
  });

  it("drains all remaining lanes at turn settle", () => {
    const { result, dispatch } = makeHook();

    act(() => {
      result.current.onReasoningSummaryDelta(
        WORKSPACE_ID,
        THREAD_ID,
        "reasoning-1",
        "摘要一",
      );
      result.current.onReasoningSummaryDelta(
        WORKSPACE_ID,
        THREAD_ID,
        "reasoning-1",
        "摘要二",
      );
      result.current.onReasoningTextDelta(
        WORKSPACE_ID,
        THREAD_ID,
        "reasoning-1",
        "正文一",
      );
      result.current.onReasoningTextDelta(
        WORKSPACE_ID,
        THREAD_ID,
        "reasoning-1",
        "正文二",
      );
    });

    act(() => {
      result.current.drainLiveItemDeltasForThread(THREAD_ID);
    });

    const actions = dispatch.mock.calls.map(
      ([action]) => action as Record<string, unknown>,
    );
    const summaryDeltas = actions
      .filter((action) => action.type === "appendReasoningSummary")
      .map((action) => action.delta);
    const contentDeltas = actions
      .filter((action) => action.type === "appendReasoningContent")
      .map((action) => action.delta);
    expect(summaryDeltas).toEqual(["摘要一", "摘要二"]);
    expect(contentDeltas).toEqual(["正文一", "正文二"]);
    expect(peekLiveItemDelta(THREAD_ID, "reasoning-1", "reasoningSummary")).toBe(
      "",
    );
    expect(peekLiveItemDelta(THREAD_ID, "reasoning-1", "reasoningContent")).toBe(
      "",
    );
  });

  it("drains reasoning tails before incrementAgentSegment at a tool boundary", () => {
    // A4 二期：思考只有建壳首段落 reducer。Grok jsonl 工具开始时前端会
    // incrementAgentSegment；若不先灌回思考尾段，collapse 只会把多个首 token
    // 用 \n\n 拼成「token / ， / -meter」沙拉。
    const { result, dispatch } = makeHook();

    act(() => {
      result.current.onReasoningTextDelta(
        WORKSPACE_ID,
        THREAD_ID,
        "reasoning-1",
        "token",
      );
      result.current.onReasoningTextDelta(
        WORKSPACE_ID,
        THREAD_ID,
        "reasoning-1",
        "-meter 用量先核对。",
      );
    });

    expect(
      dispatchedTypes(dispatch).filter(
        (type) => type === "appendReasoningContent",
      ),
    ).toHaveLength(1);
    expect(peekLiveItemDelta(THREAD_ID, "reasoning-1", "reasoningContent")).toBe(
      "token-meter 用量先核对。",
    );

    act(() => {
      result.current.onItemStarted(WORKSPACE_ID, THREAD_ID, {
        type: "commandExecution",
        id: "tool-1",
      });
    });

    const actions = dispatch.mock.calls.map(
      ([action]) => action as Record<string, unknown>,
    );
    const contentDeltas = actions
      .filter((action) => action.type === "appendReasoningContent")
      .map((action) => action.delta);
    expect(contentDeltas).toEqual(["token", "-meter 用量先核对。"]);

    const types = dispatchedTypes(dispatch);
    const drainIndex = types.lastIndexOf("appendReasoningContent");
    const incrementIndex = types.indexOf("incrementAgentSegment");
    expect(incrementIndex).toBeGreaterThan(-1);
    expect(drainIndex).toBeLessThan(incrementIndex);
    expect(peekLiveItemDelta(THREAD_ID, "reasoning-1", "reasoningContent")).toBe(
      "",
    );
  });
});
