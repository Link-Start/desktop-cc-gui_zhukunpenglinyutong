// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getClientStoreSync, writeClientStoreData } from "../../../services/clientStorage";
import { appendClientErrorLog } from "../../../services/tauri";
import {
  MAX_THREAD_SESSION_LOG_PAYLOAD_CHARS,
  useDebugLog,
} from "./useDebugLog";

vi.mock("../../../services/tauri", () => ({
  appendClientErrorLog: vi.fn().mockResolvedValue({
    filePath: "/Users/demo/.ccgui/error-log/2026-05-29.jsonl",
  }),
}));

describe("useDebugLog", () => {
  beforeEach(() => {
    writeClientStoreData("app", {});
    writeClientStoreData("diagnostics", {});
    vi.clearAllMocks();
  });

  it("mirrors thread continuity diagnostics into the thread session log store", () => {
    const { result } = renderHook(() => useDebugLog());

    act(() => {
      result.current.addDebugEntry({
        id: "entry-1",
        timestamp: 123,
        source: "client",
        label: "thread/list fallback",
        payload: {
          workspaceId: "ws-1",
          action: "thread-list-fallback",
          recoveryState: "degraded",
        },
      });
    });

    expect(getClientStoreSync("diagnostics", "diagnostics.threadSessionLog")).toEqual([
      {
        timestamp: 123,
        source: "client",
        label: "thread/list fallback",
        payload: {
          workspaceId: "ws-1",
          action: "thread-list-fallback",
          recoveryState: "degraded",
        },
      },
    ]);
  });

  it("does not mirror high-churn watchdog scheduling diagnostics", () => {
    const { result } = renderHook(() => useDebugLog());

    act(() => {
      result.current.addDebugEntry({
        id: "entry-scheduled",
        timestamp: 124,
        source: "event",
        label: "thread/session:turn-diagnostic:codex-no-progress-watchdog-scheduled",
        payload: {
          workspaceId: "ws-1",
          threadId: "thread-1",
          progressSequence: 42,
        },
      });
    });

    expect(getClientStoreSync("diagnostics", "diagnostics.threadSessionLog")).toBeUndefined();
  });

  it("does not mirror raw thread list responses into the durable session log", () => {
    const { result } = renderHook(() => useDebugLog());

    act(() => {
      result.current.addDebugEntry({
        id: "entry-thread-list-response",
        timestamp: 125,
        source: "server",
        label: "thread/list response",
        payload: {
          result: {
            data: Array.from({ length: 100 }, (_, index) => ({
              id: `thread-${index}`,
              cwd: "/Users/demo/project",
              lastAssistantMessage: "large payload should not be persisted",
            })),
          },
        },
      });
    });

    expect(getClientStoreSync("diagnostics", "diagnostics.threadSessionLog")).toBeUndefined();
  });

  it("truncates oversized payloads before mirroring into the thread session log", () => {
    const { result } = renderHook(() => useDebugLog());

    act(() => {
      result.current.addDebugEntry({
        id: "entry-oversized",
        timestamp: 126,
        source: "event",
        label: "thread/session:turn-start",
        payload: {
          workspaceId: "ws-1",
          blob: "x".repeat(MAX_THREAD_SESSION_LOG_PAYLOAD_CHARS + 1_000),
        },
      });
    });

    const persisted = getClientStoreSync<Array<{ payload: unknown }>>(
      "diagnostics",
      "diagnostics.threadSessionLog",
    );
    expect(persisted).toHaveLength(1);
    const payload = persisted![0]!.payload;
    expect(typeof payload).toBe("string");
    expect((payload as string).length).toBeLessThan(MAX_THREAD_SESSION_LOG_PAYLOAD_CHARS);
    expect(payload).toContain("...(truncated");
  });

  it("persists sanitized core errors through the global client error log", () => {
    const { result } = renderHook(() => useDebugLog());

    act(() => {
      result.current.addDebugEntry({
        id: "entry-2",
        timestamp: Date.UTC(2026, 4, 29, 12, 0, 0),
        source: "error",
        label: "terminal write error",
        payload: {
          workspaceId: "ws-1",
          token: "secret-token",
          stderr: "very noisy terminal output",
        },
      });
    });

    expect(appendClientErrorLog).toHaveBeenCalledWith({
      schemaVersion: 1,
      timestamp: "2026-05-29T12:00:00.000Z",
      source: "error",
      label: "terminal write error",
      payload: {
        workspaceId: "ws-1",
        token: "[redacted]",
        stderr: { redactedText: true, length: 26 },
      },
    });
  });

  it("buffers loggable entries while the panel is closed and flushes them on open", () => {
    const { result } = renderHook(() => useDebugLog());

    act(() => {
      result.current.addDebugEntry({
        id: "buffered-1",
        timestamp: 100,
        source: "error",
        label: "engine crashed",
        payload: "boom",
      });
    });

    // 面板关闭：条目不进 React state（避免每条日志一次根渲染），但红点已亮。
    expect(result.current.debugEntries).toEqual([]);
    expect(result.current.hasDebugAlerts).toBe(true);

    act(() => {
      result.current.setDebugOpen(true);
    });

    // 打开面板：缓冲一次性灌入。
    expect(result.current.debugEntries.map((entry) => entry.id)).toEqual([
      "buffered-1",
    ]);

    act(() => {
      result.current.addDebugEntry({
        id: "live-1",
        timestamp: 200,
        source: "error",
        label: "engine crashed again",
        payload: "boom",
      });
    });

    // 面板打开期间：条目实时进 state。
    expect(result.current.debugEntries.map((entry) => entry.id)).toEqual([
      "buffered-1",
      "live-1",
    ]);
  });

  it("does not replay cleared entries when the panel is reopened", () => {
    const { result } = renderHook(() => useDebugLog());

    act(() => {
      result.current.addDebugEntry({
        id: "stale-1",
        timestamp: 100,
        source: "error",
        label: "old failure",
        payload: "boom",
      });
    });

    act(() => {
      result.current.clearDebugEntries();
    });

    act(() => {
      result.current.setDebugOpen(true);
    });

    expect(result.current.debugEntries).toEqual([]);
  });
});
