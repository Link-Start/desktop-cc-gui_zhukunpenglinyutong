// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  resetSharedProviderTargetCatalogForTests,
  useSharedProviderTargetCatalog,
} from "./useSharedProviderTargetCatalog";
import {
  getClaudeProviders,
  getCodexProviders,
  getEngineModels,
  getKimiProviders,
} from "../../../../../services/tauri";

vi.mock("../../../../../services/tauri", () => ({
  getClaudeProviders: vi.fn(),
  getCodexProviders: vi.fn(),
  getKimiProviders: vi.fn(),
  getEngineModels: vi.fn(),
}));

const getClaudeProvidersMock = vi.mocked(getClaudeProviders);
const getCodexProvidersMock = vi.mocked(getCodexProviders);
const getKimiProvidersMock = vi.mocked(getKimiProviders);
const getEngineModelsMock = vi.mocked(getEngineModels);

describe("useSharedProviderTargetCatalog", () => {
  beforeEach(() => {
    resetSharedProviderTargetCatalogForTests();
    vi.clearAllMocks();
    getClaudeProvidersMock.mockResolvedValue([
      { id: "claude-a", name: "Claude A" },
    ]);
    getCodexProvidersMock.mockResolvedValue([
      { id: "codex-b", name: "Codex B" },
    ]);
    getKimiProvidersMock.mockResolvedValue([
      {
        id: "kimi-c",
        name: "Kimi C",
        baseUrl: "",
        apiKey: "",
        model: "",
      },
    ]);
    getEngineModelsMock.mockResolvedValue([
      {
        id: "same-model",
        displayName: "Scoped model",
        description: "",
        isDefault: true,
      },
    ]);
  });

  it("loads profiles once and models only for the opened binding", async () => {
    const { result } = renderHook(() =>
      useSharedProviderTargetCatalog({
        enabled: true,
        currentProvider: "claude",
        currentProviderProfileId: "claude-a",
        currentModels: [],
        resolveProviderLabel: (provider) => provider,
        kimiDisabledReason: "source only",
      }),
    );

    expect(getEngineModelsMock).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.ensureProfiles();
      await result.current.ensureProfiles();
    });
    expect(getClaudeProvidersMock).toHaveBeenCalledOnce();
    expect(result.current.groups.find((group) => group.providerId === "kimi"))
      .toMatchObject({ enabled: false, disabledReason: "source only" });

    await act(async () => {
      await result.current.ensureModels("codex", "codex-b");
      await result.current.ensureModels("codex", "codex-b");
    });
    expect(getEngineModelsMock).toHaveBeenCalledOnce();
    expect(getEngineModelsMock).toHaveBeenCalledWith("codex", {
      providerProfileId: "codex-b",
    });
    expect(
      result.current.groups
        .find((group) => group.providerId === "codex")
        ?.profiles.find((profile) => profile.id === "codex-b")
        ?.models,
    ).toEqual([
      expect.objectContaining({ id: "same-model", label: "Scoped model" }),
    ]);
  });

  it("keeps other CLIs usable when one Provider catalog fails", async () => {
    getKimiProvidersMock.mockRejectedValueOnce(new Error("kimi unavailable"));
    const { result } = renderHook(() =>
      useSharedProviderTargetCatalog({
        enabled: true,
        currentProvider: "claude",
        currentProviderProfileId: null,
        currentModels: [{ id: "local-model", label: "Local model" }],
        resolveProviderLabel: (provider) => provider,
        kimiDisabledReason: "source only",
      }),
    );

    await act(async () => {
      await result.current.ensureProfiles();
    });

    expect(result.current.profileLoadError).toBeNull();
    expect(
      result.current.groups
        .find((group) => group.providerId === "claude")
        ?.profiles.find(
          (profile) => profile.id === "__local_settings_json__",
        )?.models,
    ).toEqual([{ id: "local-model", label: "Local model" }]);
    expect(
      result.current.groups.find((group) => group.providerId === "kimi")
        ?.profiles,
    ).toEqual([
      expect.objectContaining({ id: "__local_config_toml__" }),
    ]);
  });

  it("surfaces a binding-scoped model failure without replacing the catalog", async () => {
    getEngineModelsMock.mockRejectedValueOnce(new Error("provider offline"));
    const { result } = renderHook(() =>
      useSharedProviderTargetCatalog({
        enabled: true,
        currentProvider: "claude",
        currentProviderProfileId: "claude-a",
        currentModels: [],
        resolveProviderLabel: (provider) => provider,
        kimiDisabledReason: "source only",
      }),
    );
    await act(async () => {
      await result.current.ensureProfiles();
      await result.current.ensureModels("codex", "codex-b");
    });

    expect(
      result.current.groups
        .find((group) => group.providerId === "codex")
        ?.profiles.find((profile) => profile.id === "codex-b")?.error,
    ).toBe("provider offline");
    expect(
      result.current.groups.find((group) => group.providerId === "claude")
        ?.profiles,
    ).toEqual(expect.arrayContaining([expect.objectContaining({ id: "claude-a" })]));
  });
});
