// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../types";
import { buildSessionOverview } from "./sessionOverviewViewModel";

const userMessage = (id: string): ConversationItem =>
  ({
    kind: "message",
    id,
    role: "user",
    text: "hi",
  }) as ConversationItem;

const assistantMessage = (id: string): ConversationItem =>
  ({
    kind: "message",
    id,
    role: "assistant",
    text: "hello",
  }) as ConversationItem;

describe("buildSessionOverview", () => {
  it("derives status, counts, and context fields from store-shaped input", () => {
    const overview = buildSessionOverview({
      engine: "claude",
      model: "claude-sonnet",
      workspaceName: "mossx",
      workspacePath: "/tmp/mossx",
      isProcessing: true,
      threadStatus: {
        isProcessing: true,
        processingStartedAt: 1_000,
      },
      items: [userMessage("u1"), assistantMessage("a1"), userMessage("u2")],
      tokenUsage: {
        contextUsedPercent: 42.6,
        contextUsedTokens: 12_000,
        modelContextWindow: 200_000,
      } as never,
      rateLimits: {
        primary: { usedPercent: 18.2 },
      } as never,
      pendingApprovals: 2,
      pendingUserInputs: 1,
      nowMs: 4_000,
    });

    expect(overview).toMatchObject({
      engine: "claude",
      model: "claude-sonnet",
      workspaceLabel: "mossx",
      status: "running",
      durationMs: 3_000,
      messageCount: 3,
      turnCount: 2,
      contextUsedPercent: 43,
      contextUsedTokens: 12_000,
      modelContextWindow: 200_000,
      rateLimitPrimaryPercent: 18,
      pendingApprovals: 2,
      pendingUserInputs: 1,
      hasAnyContent: true,
    });
  });

  it("falls back workspace path basename and hides zero pending noise", () => {
    const overview = buildSessionOverview({
      engine: null,
      model: null,
      workspaceName: null,
      workspacePath: "/Users/demo/project",
      isProcessing: false,
      threadStatus: {
        lastDurationMs: 1_500,
      },
      items: [],
      tokenUsage: null,
      rateLimits: null,
      pendingApprovals: 0,
      pendingUserInputs: 0,
      nowMs: 10_000,
    });

    expect(overview.workspaceLabel).toBe("project");
    expect(overview.status).toBe("idle");
    expect(overview.durationMs).toBe(1_500);
    expect(overview.pendingApprovals).toBe(0);
    expect(overview.pendingUserInputs).toBe(0);
    expect(overview.hasAnyContent).toBe(true);
  });

  it("renders empty-state when no engine, workspace, messages, or context", () => {
    const overview = buildSessionOverview({
      engine: null,
      model: null,
      workspaceName: null,
      workspacePath: null,
      isProcessing: false,
      threadStatus: null,
      items: [],
      tokenUsage: null,
      rateLimits: null,
      pendingApprovals: 0,
      pendingUserInputs: 0,
      nowMs: 0,
    });

    expect(overview.hasAnyContent).toBe(false);
    expect(overview.status).toBe("idle");
  });

  it("marks compacting when thread status reports context compaction", () => {
    const overview = buildSessionOverview({
      engine: "codex",
      model: "gpt",
      workspaceName: "demo",
      workspacePath: null,
      isProcessing: true,
      threadStatus: {
        isContextCompacting: true,
        processingStartedAt: 100,
      },
      items: [userMessage("u1")],
      tokenUsage: null,
      rateLimits: null,
      pendingApprovals: 0,
      pendingUserInputs: 0,
      nowMs: 200,
    });

    expect(overview.status).toBe("compacting");
    expect(overview.durationMs).toBe(100);
  });
});
