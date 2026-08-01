import { describe, expect, it } from "vitest";
import { domainEventFactories } from "./eventFactories";
import { DOMAIN_EVENT_TYPES } from "./eventTypes";

const common = {
  occurredAt: "2026-05-19T10:00:00.000Z",
  workspaceId: "workspace-1",
  sessionId: "thread-1",
  engine: "codex" as const,
};

describe("domain event factories", () => {
  it("exports exactly the documented eleven event types", () => {
    expect(DOMAIN_EVENT_TYPES).toEqual([
      "session.started",
      "session.ended",
      "turn.started",
      "turn.completed",
      "turn.failed",
      "message.delta.appended",
      "message.completed",
      "tool.started",
      "tool.completed",
      "usage.updated",
      "run.settled",
    ]);
  });

  it("requires caller-provided ISO occurredAt and common identity fields", () => {
    const event = domainEventFactories.turnStarted({
      ...common,
      turnId: "turn-1",
    });

    expect(event).toMatchObject({
      type: "turn.started",
      occurredAt: common.occurredAt,
      workspaceId: common.workspaceId,
      sessionId: common.sessionId,
      engine: common.engine,
      logicalSessionId: common.sessionId,
      runId: "turn-1",
      engineId: common.engine,
      provenance: {
        source: "legacy-domain-event-adapter",
        rawEventType: "turn.started",
      },
    });
  });

  it("creates explicit run settlement evidence", () => {
    expect(
      domainEventFactories.runSettled({
        ...common,
        logicalSessionId: "logical-1",
        runId: "run-1",
        engineId: "codex",
        provenance: { source: "codex-adapter", rawEventType: "turn/completed" },
        status: "completed",
      }),
    ).toMatchObject({
      type: "run.settled",
      logicalSessionId: "logical-1",
      runId: "run-1",
      status: "completed",
    });
  });

  it("rejects invalid timestamps instead of defaulting a clock", () => {
    expect(() =>
      domainEventFactories.sessionStarted({
        ...common,
        occurredAt: "not-a-date",
        threadId: "thread-1",
      }),
    ).toThrow(/ISO 8601/);
  });
});
