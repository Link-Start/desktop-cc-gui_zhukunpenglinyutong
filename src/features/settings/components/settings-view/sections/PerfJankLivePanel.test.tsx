// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RendererDiagnosticEntry } from "@/services/rendererDiagnostics";

const diagnosticsState = vi.hoisted(() => ({
  entries: [] as Array<{
    timestamp: number;
    label: string;
    payload: Record<string, unknown>;
  }>,
}));

vi.mock("@/services/rendererDiagnostics", () => ({
  exportRendererDiagnostics: vi.fn(() => diagnosticsState.entries),
  clearRendererDiagnostics: vi.fn(() => {
    diagnosticsState.entries = [];
  }),
}));

import {
  clearRendererDiagnostics,
  exportRendererDiagnostics,
} from "@/services/rendererDiagnostics";
import { PerfJankLivePanel } from "./PerfJankLivePanel";

function frameDropEntry(
  timestamp: number,
  deltaMs: number,
  overrides: Record<string, unknown> = {},
): RendererDiagnosticEntry {
  return {
    timestamp,
    label: "perf.frame-drop",
    payload: {
      deltaMs,
      level: deltaMs >= 100 ? "severe" : "warn",
      isStreaming: true,
      streamActivityPhase: "waiting",
      lastInteractionLabel: "key",
      lastInteractionAgoMs: 120,
      topRenders: [{ name: "ActiveCanvasMessages", count: 3 }],
      ...overrides,
    },
  };
}

describe("PerfJankLivePanel", () => {
  beforeEach(() => {
    diagnosticsState.entries = [];
    vi.mocked(exportRendererDiagnostics).mockClear();
    vi.mocked(clearRendererDiagnostics).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lists captured frame drops with attribution, newest first", () => {
    diagnosticsState.entries = [
      frameDropEntry(1_000, 60, { topRenders: [] }),
      frameDropEntry(2_000, 216),
      { timestamp: 3_000, label: "renderer/install", payload: {} },
      // 挂起恢复级别的天文数字不属于卡顿,必须被过滤。
      frameDropEntry(4_000, 90_000),
    ];

    render(<PerfJankLivePanel />);

    const list = screen.getByRole("list", {
      name: "settings.perfJankLiveTitle",
    });
    const rows = list.querySelectorAll("li");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain("216ms");
    expect(rows[0]?.textContent).toContain("streaming:waiting");
    expect(rows[0]?.textContent).toContain("key@120ms");
    expect(rows[0]?.textContent).toContain("ActiveCanvasMessages×3");
    expect(rows[1]?.textContent).toContain("60ms");
    expect(rows[1]?.textContent).toContain("settings.perfJankLiveNoRenders");
  });

  it("clears all diagnostics and shows the empty state", () => {
    diagnosticsState.entries = [frameDropEntry(1_000, 216)];

    render(<PerfJankLivePanel />);
    expect(screen.getByRole("list", { name: "settings.perfJankLiveTitle" })).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "settings.perfJankLiveClearButton" }),
    );

    expect(vi.mocked(clearRendererDiagnostics)).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("list", { name: "settings.perfJankLiveTitle" })).toBeNull();
    expect(screen.getByText("settings.perfJankLiveCleared")).toBeTruthy();
  });

  it("picks up new entries on the refresh tick", () => {
    vi.useFakeTimers();
    render(<PerfJankLivePanel />);
    expect(screen.getByText("settings.perfJankLiveEmpty")).toBeTruthy();

    diagnosticsState.entries = [frameDropEntry(5_000, 130)];
    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(
      screen.getByRole("list", { name: "settings.perfJankLiveTitle" }).textContent,
    ).toContain("130ms");
  });
});
