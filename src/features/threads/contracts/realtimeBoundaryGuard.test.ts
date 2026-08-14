import { describe, expect, it } from "vitest";
import {
  buildThreeThreadReplayEventsForMinutes,
  REALTIME_REPLAY_BATCH_WINDOW_MS,
  REALTIME_REPLAY_WORKSPACE_ID,
} from "./realtimeReplayFixture";
import { runReplayProfile } from "./realtimeReplayHarness";
import type { RealtimeReplayEvent } from "./realtimeReplayTypes";

const LIVE_ITEM_APPEND_ACTION_TYPES = new Set([
  "appendReasoningSummary",
  "appendReasoningContent",
  "appendToolOutput",
]);

function countLiveItemAppendActions(
  actionPlan: Array<{ action: { type: string } }>,
): number {
  return actionPlan.filter(({ action }) =>
    LIVE_ITEM_APPEND_ACTION_TYPES.has(action.type),
  ).length;
}

/**
 * 长思考回合速写：单线程一回合内 60 条 reasoningContent + 10 条
 * reasoningSummary + 40 条 toolOutput delta（~30 条/秒的电报密度），
 * 以 agentCompleted 作 turn settle。
 */
function buildLongReasoningTurnReplayEvents(): RealtimeReplayEvent[] {
  const threadId = "claude:replay-long-reasoning";
  const reasoningId = `${threadId}:reasoning:turn-1`;
  const toolId = `${threadId}:tool:turn-1`;
  const assistantId = `${threadId}:assistant:turn-1`;
  const events: RealtimeReplayEvent[] = [];
  const base = { workspaceId: REALTIME_REPLAY_WORKSPACE_ID, threadId };

  events.push({
    id: "tool-start",
    kind: "toolStarted",
    ...base,
    itemId: toolId,
    command: "pnpm vitest --run",
    atMs: 0,
  });
  for (let index = 0; index < 60; index += 1) {
    events.push({
      id: `reasoning-content-${index}`,
      kind: "reasoningContentDelta",
      ...base,
      itemId: reasoningId,
      delta: `推理片段 ${index}。`,
      atMs: 10 + index * 10,
    });
    if (index % 6 === 0) {
      events.push({
        id: `reasoning-summary-${index}`,
        kind: "reasoningSummaryDelta",
        ...base,
        itemId: reasoningId,
        // 注意：逐 delta merge 会逐次 trim 段尾空白，而通道 concat 只在 drain
        // 后整体 normalize 一次——两种路径对「段尾空白」的处理存在装饰性差异。
        // 契约断言字节等价，故 delta 以标点结尾、不带尾空白（内容完整性由
        // integrity 的归一化 contains 检查覆盖）。
        delta: `摘要 ${index}。`,
        atMs: 11 + index * 10,
      });
    }
    if (index % 3 === 2) {
      events.push({
        id: `tool-output-${index}`,
        kind: "toolOutputDelta",
        ...base,
        itemId: toolId,
        delta: `output-${index}\n`,
        atMs: 12 + index * 10,
      });
    }
  }
  events.push({
    id: "agent-delta-1",
    kind: "agentDelta",
    ...base,
    itemId: assistantId,
    delta: "最终回答。",
    atMs: 700,
  });
  events.push({
    id: "agent-complete",
    kind: "agentCompleted",
    ...base,
    itemId: assistantId,
    text: "最终回答。",
    atMs: 720,
  });
  return events;
}

describe("realtime boundary guard", () => {
  it("keeps ordering, terminal lifecycle, and payload completeness equivalent", async () => {
    const events = buildThreeThreadReplayEventsForMinutes(5);
    const baseline = await runReplayProfile({
      events,
      profile: "baseline",
      batchWindowMs: REALTIME_REPLAY_BATCH_WINDOW_MS,
    });
    const optimized = await runReplayProfile({
      events,
      profile: "optimized",
      batchWindowMs: REALTIME_REPLAY_BATCH_WINDOW_MS,
    });

    expect(optimized.semanticsHash).toBe(baseline.semanticsHash);
    expect(optimized.semanticsSnapshot).toEqual(baseline.semanticsSnapshot);
    expect(baseline.integrity).toEqual({
      missingAgentMessages: [],
      missingReasoningItems: [],
      missingToolOutputs: [],
      stuckProcessingThreads: [],
    });
    expect(optimized.integrity).toEqual({
      missingAgentMessages: [],
      missingReasoningItems: [],
      missingToolOutputs: [],
      stuckProcessingThreads: [],
    });
  });

  // A4 二期（liveDeltaExternalization 开）：reasoningContent / reasoningSummary /
  // toolOutput 三类电报不进根 dispatch——每 lane 每回合只有「建壳 + settle drain」
  // 两次落账，且 settle 后 durable items 与 baseline 逐字节等价、无内容缺失。
  it("keeps reasoning/toolOutput deltas out of the root dispatch path when liveDeltaExternalization is on", async () => {
    const events = buildLongReasoningTurnReplayEvents();
    const baseline = await runReplayProfile({
      events,
      profile: "baseline",
      batchWindowMs: REALTIME_REPLAY_BATCH_WINDOW_MS,
    });
    const liveDelta = await runReplayProfile({
      events,
      profile: "liveDelta",
      batchWindowMs: REALTIME_REPLAY_BATCH_WINDOW_MS,
    });

    // 语义与完整性等价（settle 后 durable items 是唯一真相）。
    expect(liveDelta.semanticsHash).toBe(baseline.semanticsHash);
    expect(liveDelta.semanticsSnapshot).toEqual(baseline.semanticsSnapshot);
    expect(liveDelta.integrity).toEqual({
      missingAgentMessages: [],
      missingReasoningItems: [],
      missingToolOutputs: [],
      stuckProcessingThreads: [],
    });

    const baselineAppends = countLiveItemAppendActions(baseline.actionPlan);
    const liveDeltaAppends = countLiveItemAppendActions(liveDelta.actionPlan);
    // 改前：每条 delta 都打根（60 content + 10 summary + 20 output = 90 次）。
    expect(baselineAppends).toBe(90);
    // 改后：每 lane 建壳 1 次 + turn settle drain 1 次，共 6 次（回合级）。
    expect(liveDeltaAppends).toBe(6);
  });
});
