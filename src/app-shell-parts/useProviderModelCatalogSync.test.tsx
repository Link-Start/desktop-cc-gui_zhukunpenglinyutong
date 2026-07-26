// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useProviderModelCatalogSync } from "./useProviderModelCatalogSync";

describe("useProviderModelCatalogSync", () => {
  it("refreshes when the active provider scope changes", () => {
    const addDebugEntry = vi.fn();
    const refreshEngineModels = vi.fn().mockResolvedValue(undefined);
    const view = renderHook(
      ({ providerProfileId }) =>
        useProviderModelCatalogSync({
          activeEngine: "claude",
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

  it("supports Codex and Kimi but ignores engines without provider profiles", () => {
    const refreshEngineModels = vi.fn().mockResolvedValue(undefined);
    const addDebugEntry = vi.fn();
    type HookProps = {
      activeEngine: "codex" | "kimi" | "gemini";
    };
    const view = renderHook(
      ({ activeEngine }: HookProps) =>
        useProviderModelCatalogSync({
          activeEngine,
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
    view.rerender({ activeEngine: "kimi" });
    expect(refreshEngineModels).toHaveBeenLastCalledWith("kimi", {
      providerProfileId: "provider-a",
    });
    view.rerender({ activeEngine: "gemini" });

    expect(refreshEngineModels).toHaveBeenCalledTimes(2);
  });
});
