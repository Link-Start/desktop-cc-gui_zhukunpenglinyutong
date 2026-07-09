// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useClaudeModelRefreshOnNewThread } from "./useClaudeModelRefreshOnNewThread";

describe("useClaudeModelRefreshOnNewThread", () => {
  it("refreshes once per Claude pending thread key", () => {
    const addDebugEntry = vi.fn();
    const refreshEngineModels = vi.fn().mockResolvedValue(undefined);
    const view = renderHook(
      ({ activeThreadId }) =>
        useClaudeModelRefreshOnNewThread({
          activeEngine: "claude",
          activeThreadId,
          activeWorkspaceId: "ws-1",
          addDebugEntry,
          refreshEngineModels,
        }),
      { initialProps: { activeThreadId: "claude-pending-1" } },
    );

    expect(refreshEngineModels).toHaveBeenCalledTimes(1);
    expect(refreshEngineModels).toHaveBeenCalledWith("claude");
    expect(addDebugEntry).toHaveBeenCalledTimes(1);

    view.rerender({ activeThreadId: "claude-pending-1" });
    expect(refreshEngineModels).toHaveBeenCalledTimes(1);

    view.rerender({ activeThreadId: "claude-pending-2" });
    expect(refreshEngineModels).toHaveBeenCalledTimes(2);
    expect(addDebugEntry).toHaveBeenCalledTimes(2);
  });

  it("ignores non-pending or non-Claude threads", () => {
    const refreshEngineModels = vi.fn().mockResolvedValue(undefined);
    const addDebugEntry = vi.fn();
    type HookProps = {
      activeEngine: "claude" | "codex";
      activeThreadId: string;
    };
    const view = renderHook(
      ({ activeEngine, activeThreadId }: HookProps) =>
        useClaudeModelRefreshOnNewThread({
          activeEngine,
          activeThreadId,
          activeWorkspaceId: "ws-1",
          addDebugEntry,
          refreshEngineModels,
        }),
      {
        initialProps: {
          activeEngine: "claude",
          activeThreadId: "claude:session-1",
        },
      },
    );

    view.rerender({
      activeEngine: "codex",
      activeThreadId: "claude-pending-1",
    });

    expect(refreshEngineModels).not.toHaveBeenCalled();
    expect(addDebugEntry).not.toHaveBeenCalled();
  });
});
