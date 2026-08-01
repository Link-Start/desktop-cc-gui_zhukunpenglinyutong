// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EngineType } from "../types";
import { useProviderModelCatalogSync } from "./useProviderModelCatalogSync";

describe("useProviderModelCatalogSync", () => {
  it("refreshes when the active provider scope changes", () => {
    const addDebugEntry = vi.fn();
    const refreshEngineModels = vi.fn().mockResolvedValue(undefined);
    const view = renderHook(
      ({ providerProfileId }) =>
        useProviderModelCatalogSync({
          activeEngine: "claude",
          activeThreadEngineSource: "claude",
          activeThreadId: "claude-pending-1",
          activeWorkspaceId: "ws-1",
          providerProfileId,
          addDebugEntry,
          refreshEngineModels,
        }),
      { initialProps: { providerProfileId: "provider-a" } },
    );

    expect(refreshEngineModels).toHaveBeenCalledTimes(1);
    expect(refreshEngineModels).toHaveBeenCalledWith("claude", {
      providerProfileId: "provider-a",
    });
    expect(addDebugEntry).toHaveBeenCalledTimes(1);

    view.rerender({ providerProfileId: "provider-a" });
    expect(refreshEngineModels).toHaveBeenCalledTimes(1);

    view.rerender({ providerProfileId: "provider-b" });
    expect(refreshEngineModels).toHaveBeenCalledTimes(2);
    expect(refreshEngineModels).toHaveBeenLastCalledWith("claude", {
      providerProfileId: "provider-b",
    });
    expect(addDebugEntry).toHaveBeenCalledTimes(2);
  });

  it("supports Codex, Grok and Kimi but ignores engines without provider profiles", () => {
    const refreshEngineModels = vi.fn().mockResolvedValue(undefined);
    const addDebugEntry = vi.fn();
    type HookProps = {
      activeEngine: "codex" | "grok" | "kimi" | "gemini";
    };
    const view = renderHook(
      ({ activeEngine }: HookProps) =>
        useProviderModelCatalogSync({
          activeEngine,
          activeThreadEngineSource: activeEngine,
          activeThreadId: "thread-1",
          activeWorkspaceId: "ws-1",
          providerProfileId: "provider-a",
          addDebugEntry,
          refreshEngineModels,
        }),
      {
        initialProps: {
          activeEngine: "codex",
        },
      },
    );

    expect(refreshEngineModels).toHaveBeenCalledWith("codex", {
      providerProfileId: "provider-a",
    });
    view.rerender({ activeEngine: "grok" });
    expect(refreshEngineModels).toHaveBeenLastCalledWith("grok", {
      providerProfileId: "provider-a",
    });
    view.rerender({ activeEngine: "kimi" });
    expect(refreshEngineModels).toHaveBeenLastCalledWith("kimi", {
      providerProfileId: "provider-a",
    });
    view.rerender({ activeEngine: "gemini" });

    expect(refreshEngineModels).toHaveBeenCalledTimes(3);
  });

  it("uses the active thread engine while the global engine is still switching", () => {
    const refreshEngineModels = vi.fn().mockResolvedValue(undefined);
    const addDebugEntry = vi.fn();
    type HookProps = {
      activeEngine: EngineType;
    };
    const view = renderHook(
      ({ activeEngine }: HookProps) =>
        useProviderModelCatalogSync({
          activeEngine,
          activeThreadEngineSource: "codex",
          activeThreadId: "codex-thread-1",
          activeWorkspaceId: "ws-1",
          providerProfileId: "__disk__",
          addDebugEntry,
          refreshEngineModels,
        }),
      { initialProps: { activeEngine: "claude" } },
    );

    expect(refreshEngineModels).toHaveBeenCalledTimes(1);
    expect(refreshEngineModels).toHaveBeenCalledWith("codex", {
      providerProfileId: "__disk__",
    });

    view.rerender({ activeEngine: "codex" });
    expect(refreshEngineModels).toHaveBeenCalledTimes(1);
  });

  it("keeps the last-good catalog when a provider-bound thread has no engine scope", () => {
    const refreshEngineModels = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      useProviderModelCatalogSync({
        activeEngine: "claude",
        activeThreadEngineSource: null,
        activeThreadId: "legacy-thread-1",
        activeWorkspaceId: "ws-1",
        providerProfileId: "provider-a",
        addDebugEntry: vi.fn(),
        refreshEngineModels,
      }),
    );

    expect(refreshEngineModels).not.toHaveBeenCalled();
  });
});
