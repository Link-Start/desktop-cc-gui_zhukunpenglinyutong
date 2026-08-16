import { describe, expect, it } from "vitest";
import type { ThreadTokenUsage } from "../../../types";
import {
  buildEngineTaskOutputSnapshot,
  buildTaskOutputSourceFromNotification,
  engineTaskOutputProjectionInternals,
} from "./engineTaskOutputProjection";

const tokenUsage: ThreadTokenUsage = {
  total: {
    totalTokens: 1200,
    inputTokens: 700,
    cachedInputTokens: 200,
    outputTokens: 300,
    reasoningOutputTokens: 0,
  },
  last: {
    totalTokens: 120,
    inputTokens: 70,
    cachedInputTokens: 20,
    outputTokens: 30,
    reasoningOutputTokens: 0,
  },
  modelContextWindow: null,
  contextUsageFreshness: "estimated",
};

describe("engineTaskOutputProjection", () => {
  it("builds a Claude task snapshot without inventing missing fields", () => {
    const snapshot = buildEngineTaskOutputSnapshot(
      {
        id: "tool-1",
        engine: "claude",
        title: "reviewer",
        status: "running",
        taskId: "task-1",
        toolUseId: "tool-1",
        outputFilePath: "/tmp/tasks/task-1.output",
        recentOutput: "Working",
      },
      null,
    );

    expect(snapshot.engine).toBe("claude");
    expect(snapshot.taskId).toBe("task-1");
    expect(snapshot.outputFilePath).toBe("/tmp/tasks/task-1.output");
    expect(snapshot.threadId).toBeNull();
    expect(snapshot.telemetryStatus).toBe("pending");
  });

  it("preserves Codex thread identity without creating a task id", () => {
    const snapshot = buildEngineTaskOutputSnapshot(
      {
        id: "agent-1",
        engine: "codex",
        title: "agent-1",
        status: "completed",
        threadId: "agent-1",
        recentOutput: "Done",
      },
      tokenUsage,
    );

    expect(snapshot.engine).toBe("codex");
    expect(snapshot.taskId).toBeNull();
    expect(snapshot.threadId).toBe("agent-1");
    expect(snapshot.telemetryStatus).toBe("estimated");
  });

  it("maps task notifications into output sources", () => {
    const source = buildTaskOutputSourceFromNotification({
      itemId: "message-1",
      engine: "claude",
      title: "backend-reviewer",
      notification: {
        taskId: "task-7",
        toolUseId: "tool-7",
        outputFile: "/tmp/task-output.jsonl",
        status: "completed",
        summary: "Review auth flow",
        resultText: "Looks good",
      },
    });

    expect(source.taskId).toBe("task-7");
    expect(source.toolUseId).toBe("tool-7");
    expect(source.outputFilePath).toBe("/tmp/task-output.jsonl");
    expect(source.outputFileName).toBe("task-output.jsonl");
    expect(source.recentOutput).toBe("Looks good");
  });

  it("keeps the real engine for non-codex engines instead of relabeling as claude", () => {
    for (const engine of ["gemini", "kimi", "opencode", "dsh"] as const) {
      const source = buildTaskOutputSourceFromNotification({
        itemId: "message-1",
        engine,
        title: "backend-reviewer",
        notification: {
          taskId: "task-7",
          toolUseId: "tool-7",
          outputFile: null,
          status: "completed",
          summary: "Review auth flow",
          resultText: "Looks good",
        },
      });

      expect(source.engine).toBe(engine);
    }
  });

  it("normalizes unknown engine values to the explicit claude fallback", () => {
    const source = buildTaskOutputSourceFromNotification({
      itemId: "message-1",
      engine: "not-a-real-engine",
      title: "backend-reviewer",
      notification: {
        taskId: "task-7",
        toolUseId: "tool-7",
        outputFile: null,
        status: "completed",
        summary: "Review auth flow",
        resultText: "Looks good",
      },
    });

    expect(source.engine).toBe("claude");
  });

  it("truncates long recent output", () => {
    const truncated = engineTaskOutputProjectionInternals.truncateRecentOutput("x".repeat(2000));
    expect(truncated?.length).toBeLessThan(2000);
  });
});
