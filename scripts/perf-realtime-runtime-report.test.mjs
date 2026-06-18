import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { test } from "node:test";

function runScript(args) {
  return new Promise((resolve, reject) => {
    execFile("node", ["scripts/perf-realtime-runtime-report.mjs", ...args], { cwd: process.cwd() }, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

test("realtime runtime report derives measured metrics from content-safe diagnostics", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ccgui-realtime-runtime-"));
  const inputPath = join(dir, "diagnostics.json");
  const outputPath = join(dir, "runtime.json");
  await writeFile(inputPath, JSON.stringify({
    entries: [
      {
        timestamp: Date.now(),
        label: "realtime.turnTrace.summary",
        payload: {
          evidenceClass: "measured",
          deltas: {
            sendToFirstDeltaMs: 20,
            firstDeltaToFirstVisibleTextMs: 25,
            lastReducerCommitToTerminalSettlementMs: 50,
          },
          counters: {
            reducerAmplification: 2,
            appServerEventRouteDurationAvgMs: 10,
            terminalSettlementLagMs: 50,
          },
        },
      },
      {
        timestamp: Date.now(),
        label: "realtime.turnTrace.summary",
        payload: {
          evidenceClass: "measured",
          deltas: {
            sendToFirstDeltaMs: 40,
            firstDeltaToFirstVisibleTextMs: 35,
            lastReducerCommitToTerminalSettlementMs: 70,
          },
          counters: {
            reducerAmplification: 4,
            appServerEventRouteDurationAvgMs: 14,
            terminalSettlementLagMs: 70,
          },
        },
      },
      {
        timestamp: Date.now(),
        label: "stream-latency/codex-turn-start-ack",
        payload: {
          workspaceId: "ws-1",
          threadId: "thread-1",
          model: "MiniMax-M3",
          durationMs: 18,
          outcome: "ok",
        },
      },
      {
        timestamp: Date.now(),
        label: "stream-latency/codex-turn-start-ack",
        payload: {
          workspaceId: "ws-1",
          threadId: "thread-2",
          model: "MiniMax-M3",
          durationMs: 28,
          outcome: "ok",
        },
      },
      {
        timestamp: Date.now(),
        label: "stream-latency/app-server-event",
        payload: {
          traceSource: "codex-app-server",
          workspaceId: "ws-1",
          threadId: "thread-1",
          method: "item/agentMessage/delta",
          turnStartResponseToFirstTextDeltaMs: 12,
        },
      },
      {
        timestamp: Date.now(),
        label: "stream-latency/app-server-event",
        payload: {
          traceSource: "codex-app-server",
          workspaceId: "ws-1",
          threadId: "thread-2",
          method: "item/agentMessage/delta",
          turnStartResponseToFirstTextDeltaMs: 24,
        },
      },
    ],
  }), "utf-8");

  await runScript(["--input", inputPath, "--output", outputPath]);
  const fragment = JSON.parse(await readFile(outputPath, "utf-8"));
  const byMetric = new Map(fragment.metrics.map((metric) => [metric.metric, metric]));
  assert.equal(byMetric.get("firstDeltaLatencyP95")?.value, 40);
  assert.equal(byMetric.get("turnStartAckLatencyP95")?.value, 28);
  assert.equal(byMetric.get("codexPostAckFirstDeltaP95")?.value, 24);
  assert.equal(byMetric.get("visibleTextLagP95")?.value, 35);
  assert.equal(byMetric.get("reducerAmplificationMedian")?.value, 3);
  assert.equal(byMetric.get("batchFlushDurationP95")?.evidenceClass, "measured");
  assert.match(fragment.notes.join("\n"), /contentSafety=/);
});

test("realtime runtime report separates first-delta latency from visible lag", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ccgui-realtime-runtime-"));
  const inputPath = join(dir, "diagnostics.json");
  const outputPath = join(dir, "runtime.json");
  await writeFile(inputPath, JSON.stringify({
    entries: [
      {
        timestamp: Date.now(),
        label: "realtime.turnTrace.summary",
        payload: {
          traceId: "tt-slow-first-delta",
          engine: "codex",
          model: "MiniMax-M3",
          evidenceClass: "measured",
          deltas: {
            sendToFirstDeltaMs: 14_602,
            firstDeltaToFirstVisibleTextMs: 177,
            lastReducerCommitToTerminalSettlementMs: 462,
          },
          counters: {
            reducerAmplification: 1,
            appServerEventRouteDurationAvgMs: 0.167,
            terminalSettlementLagMs: 462,
          },
        },
      },
      {
        timestamp: Date.now(),
        label: "realtime.turnTrace.summary",
        payload: {
          traceId: "tt-normal-first-delta",
          engine: "codex",
          model: "MiniMax-M3",
          evidenceClass: "measured",
          deltas: {
            sendToFirstDeltaMs: 1_272,
            firstDeltaToFirstVisibleTextMs: 177,
            lastReducerCommitToTerminalSettlementMs: 462,
          },
          counters: {
            reducerAmplification: 1,
            appServerEventRouteDurationAvgMs: 0.167,
            terminalSettlementLagMs: 462,
          },
        },
      },
      {
        timestamp: Date.now(),
        label: "stream-latency/codex-turn-start-ack",
        payload: {
          workspaceId: "ws-1",
          threadId: "thread-slow",
          model: "MiniMax-M3",
          durationMs: 320,
          outcome: "ok",
        },
      },
      {
        timestamp: Date.now(),
        label: "stream-latency/codex-turn-start-ack",
        payload: {
          workspaceId: "ws-1",
          threadId: "thread-normal",
          model: "MiniMax-M3",
          durationMs: 180,
          outcome: "ok",
        },
      },
      {
        timestamp: Date.now(),
        label: "stream-latency/app-server-event",
        payload: {
          traceSource: "codex-app-server",
          workspaceId: "ws-1",
          threadId: "thread-slow",
          method: "item/agentMessage/delta",
          turnStartResponseToFirstTextDeltaMs: 14_200,
        },
      },
      {
        timestamp: Date.now(),
        label: "stream-latency/app-server-event",
        payload: {
          traceSource: "codex-app-server",
          workspaceId: "ws-1",
          threadId: "thread-normal",
          method: "item/agentMessage/delta",
          turnStartResponseToFirstTextDeltaMs: 900,
        },
      },
    ],
  }), "utf-8");

  await runScript(["--input", inputPath, "--output", outputPath]);
  const fragment = JSON.parse(await readFile(outputPath, "utf-8"));
  const byMetric = new Map(fragment.metrics.map((metric) => [metric.metric, metric]));

  assert.equal(byMetric.get("firstDeltaLatencyP95")?.value, 14602);
  assert.equal(byMetric.get("turnStartAckLatencyP95")?.value, 320);
  assert.equal(byMetric.get("codexPostAckFirstDeltaP95")?.value, 14200);
  assert.equal(byMetric.get("visibleTextLagP95")?.value, 177);
  assert.match(
    fragment.notes.join("\n"),
    /firstDeltaDominates=tt-slow-first-delta/,
  );
  assert.match(
    fragment.notes.join("\n"),
    /upstream\/provider\/startup phase/,
  );
  assert.match(
    fragment.notes.join("\n"),
    /turnStartAckComparison=firstDeltaLatencyP95:14602ms turnStartAckLatencyP95:320ms postAckFirstDeltaWaitApprox:14282ms/,
  );
  assert.match(
    fragment.notes.join("\n"),
    /codexPostAckComparison=firstDeltaLatencyP95:14602ms turnStartAckLatencyP95:320ms codexPostAckFirstDeltaP95:14200ms/,
  );
});

test("realtime runtime report does not use legacy batch wait windows as measured flush duration", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ccgui-realtime-runtime-"));
  const inputPath = join(dir, "diagnostics.json");
  const outputPath = join(dir, "runtime.json");
  await writeFile(inputPath, JSON.stringify({
    entries: [
      {
        timestamp: Date.now(),
        label: "realtime.turnTrace.summary",
        payload: {
          evidenceClass: "measured",
          deltas: {
            firstDeltaToFirstVisibleTextMs: 25,
            lastReducerCommitToTerminalSettlementMs: 50,
          },
          counters: {
            reducerAmplification: 2,
            batchFlushDurationAvgMs: 9_647.5,
            terminalSettlementLagMs: 50,
          },
        },
      },
    ],
  }), "utf-8");

  await runScript(["--input", inputPath, "--output", outputPath]);
  const fragment = JSON.parse(await readFile(outputPath, "utf-8"));
  const byMetric = new Map(fragment.metrics.map((metric) => [metric.metric, metric]));

  assert.equal(byMetric.get("batchFlushDurationP95")?.evidenceClass, "unsupported");
  assert.match(
    byMetric.get("batchFlushDurationP95")?.unsupportedReason,
    /appServerEventRouteDurationAvgMs/,
  );
});

test("realtime runtime report flags fast visible output with large summary windows as consistency caution", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ccgui-realtime-runtime-"));
  const inputPath = join(dir, "diagnostics.json");
  const outputPath = join(dir, "runtime.json");
  await writeFile(inputPath, JSON.stringify({
    entries: [
      {
        timestamp: Date.now(),
        label: "realtime.turnTrace.summary",
        payload: {
          traceId: "tt-fast-visible-large-summary",
          evidenceClass: "measured",
          deltas: {
            firstDeltaToFirstVisibleTextMs: 177,
            firstDeltaToBatchFlushEndMs: 21_095,
            batchFlushEndToReducerCommitMs: 12_433,
            lastReducerCommitToTerminalSettlementMs: 1_788,
          },
          counters: {
            visibleTextGrowthCount: 1,
            reducerAmplification: 1,
            batchFlushDurationAvgMs: 19_962,
            appServerEventRouteDurationAvgMs: 3,
            terminalSettlementLagMs: 1_788,
          },
        },
      },
    ],
  }), "utf-8");

  await runScript(["--input", inputPath, "--output", outputPath]);
  const fragment = JSON.parse(await readFile(outputPath, "utf-8"));

  assert.match(
    fragment.notes.join("\n"),
    /traceConsistencyCaution=tt-fast-visible-large-summary/,
  );
  assert.match(
    fragment.notes.join("\n"),
    /inspect turnTrace\/snapshot consistency before claiming client batch or reducer lag/,
  );
});

test("realtime runtime report keeps missing diagnostics unsupported", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ccgui-realtime-runtime-"));
  const outputPath = join(dir, "runtime.json");
  await runScript(["--input", join(dir, "missing.json"), "--output", outputPath]);
  const fragment = JSON.parse(await readFile(outputPath, "utf-8"));
  assert.equal(fragment.metrics[0]?.evidenceClass, "unsupported");
  assert.match(fragment.metrics[0]?.unsupportedReason, /No measured realtime/);
});
