// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SessionOverviewSection } from "./SessionOverviewSection";
import { buildSessionOverview } from "../utils/sessionOverviewViewModel";

const NOW = 1_800_000_000_000;

describe("SessionOverviewSection", () => {
  it("renders the empty state when no session content exists", () => {
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
      nowMs: NOW,
    });

    render(<SessionOverviewSection overview={overview} />);

    expect(screen.getByText("Session overview")).toBeTruthy();
    expect(screen.getByText("No active session yet")).toBeTruthy();
  });

  it("renders identity, activity, context and pending badges", () => {
    const overview = buildSessionOverview({
      engine: "codex",
      model: "gpt-5",
      workspaceName: "mossx",
      workspacePath: "/Users/dev/code/mossx",
      isProcessing: true,
      threadStatus: { isProcessing: true, processingStartedAt: NOW - 65_000 },
      items: [
        { id: "u1", kind: "message", role: "user", text: "hi" },
        { id: "a1", kind: "message", role: "assistant", text: "hello" },
      ],
      tokenUsage: {
        contextUsedPercent: 42,
        contextUsedTokens: 84_000,
        modelContextWindow: 200_000,
      } as Parameters<typeof buildSessionOverview>[0]["tokenUsage"],
      rateLimits: {
        primary: { usedPercent: 66, windowDurationMins: 300, resetsAt: null },
        secondary: null,
        credits: null,
        planType: null,
      },
      pendingApprovals: 2,
      pendingUserInputs: 1,
      nowMs: NOW,
    });

    render(<SessionOverviewSection overview={overview} />);

    expect(screen.getByText("Session overview")).toBeTruthy();
    expect(screen.getByText("Running")).toBeTruthy();
    expect(screen.getByText("codex · gpt-5")).toBeTruthy();
    expect(screen.getByText("mossx")).toBeTruthy();
    expect(screen.getByText("Current turn 1m 5s")).toBeTruthy();
    expect(screen.getByText("1 turns · 2 messages")).toBeTruthy();
    expect(screen.getByText(/Context 42%/)).toBeTruthy();
    expect(screen.getByText(/84\.0K\/200\.0K/)).toBeTruthy();
    expect(screen.getByText("Rate limit used 66%")).toBeTruthy();
    expect(screen.getByText("2 approval(s) pending")).toBeTruthy();
    expect(screen.getByText("1 question(s) pending")).toBeTruthy();
  });

  it("hides pending badges when nothing awaits the user", () => {
    const overview = buildSessionOverview({
      engine: "codex",
      model: null,
      workspaceName: "mossx",
      workspacePath: null,
      isProcessing: false,
      threadStatus: null,
      items: [],
      tokenUsage: null,
      rateLimits: null,
      pendingApprovals: 0,
      pendingUserInputs: 0,
      nowMs: NOW,
    });

    render(<SessionOverviewSection overview={overview} />);

    expect(screen.queryByText(/approval\(s\) pending/)).toBeNull();
    expect(screen.queryByText(/question\(s\) pending/)).toBeNull();
    expect(screen.getByText("Idle")).toBeTruthy();
  });
});
