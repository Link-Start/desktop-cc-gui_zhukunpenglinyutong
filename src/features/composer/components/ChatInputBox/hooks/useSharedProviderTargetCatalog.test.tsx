// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  resetSharedProviderTargetCatalogForTests,
  useSharedProviderTargetCatalog,
} from "./useSharedProviderTargetCatalog";
import {
  discoverCodexModels,
  getClaudeProviders,
  getCodexProviders,
  getEngineModels,
  getKimiProviders,
} from "../../../../../services/tauri";

vi.mock("../../../../../services/tauri", () => ({
  discoverCodexModels: vi.fn(),
  getClaudeProviders: vi.fn(),
  getCodexProviders: vi.fn(),
  getKimiProviders: vi.fn(),
  getEngineModels: vi.fn(),
}));

const getClaudeProvidersMock = vi.mocked(getClaudeProviders);
const getCodexProvidersMock = vi.mocked(getCodexProviders);
const getKimiProvidersMock = vi.mocked(getKimiProviders);
const getEngineModelsMock = vi.mocked(getEngineModels);
const discoverCodexModelsMock = vi.mocked(discoverCodexModels);

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
    discoverCodexModelsMock.mockResolvedValue({ data: [] });
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

  it("bypasses a completed cache entry when Shared reopens a local Provider", async () => {
    getEngineModelsMock.mockResolvedValueOnce([
      {
        id: "settings-main",
        model: "stale-runtime-model",
        displayName: "Stale Local Model",
        description: "",
        isDefault: true,
      },
    ]);
    const firstHook = renderHook(() =>
      useSharedProviderTargetCatalog({
        enabled: true,
        mode: "shared",
        currentProvider: "codex",
        currentProviderProfileId: "codex-b",
        currentModels: [],
        resolveProviderLabel: (provider) => provider,
        kimiDisabledReason: "source only",
      }),
    );

    await act(async () => {
      await firstHook.result.current.ensureModels(
        "claude",
        "__local_settings_json__",
      );
    });
    firstHook.unmount();

    getEngineModelsMock.mockResolvedValueOnce([
      {
        id: "settings-main",
        model: "kimi-for-coding",
        displayName: "kimi-for-coding",
        description: "",
        isDefault: true,
      },
    ]);
    const secondHook = renderHook(() =>
      useSharedProviderTargetCatalog({
        enabled: true,
        mode: "shared",
        currentProvider: "codex",
        currentProviderProfileId: "codex-b",
        currentModels: [],
        resolveProviderLabel: (provider) => provider,
        kimiDisabledReason: "source only",
      }),
    );

    expect(
      secondHook.result.current.groups
        .find((group) => group.providerId === "claude")
        ?.profiles.find(
          (profile) => profile.id === "__local_settings_json__",
        )?.models,
    ).toEqual([]);

    await act(async () => {
      await secondHook.result.current.ensureModels(
        "claude",
        "__local_settings_json__",
      );
    });

    expect(getEngineModelsMock).toHaveBeenCalledTimes(2);
    expect(getEngineModelsMock).toHaveBeenLastCalledWith("claude", {
      providerProfileId: "__local_settings_json__",
      forceRefresh: true,
    });
    expect(
      secondHook.result.current.groups
        .find((group) => group.providerId === "claude")
        ?.profiles.find(
          (profile) => profile.id === "__local_settings_json__",
        )?.models,
    ).toEqual([
      expect.objectContaining({
        id: "settings-main",
        model: "kimi-for-coding",
      }),
    ]);
  });

  it("coalesces concurrent Shared local Provider refreshes", async () => {
    let resolveModels:
      | ((models: Awaited<ReturnType<typeof getEngineModels>>) => void)
      | undefined;
    getEngineModelsMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveModels = resolve;
        }),
    );
    const { result } = renderHook(() =>
      useSharedProviderTargetCatalog({
        enabled: true,
        mode: "shared",
        currentProvider: "codex",
        currentProviderProfileId: "codex-b",
        currentModels: [],
        resolveProviderLabel: (provider) => provider,
        kimiDisabledReason: "source only",
      }),
    );

    await act(async () => {
      const firstRequest = result.current.ensureModels(
        "claude",
        "__local_settings_json__",
      );
      const secondRequest = result.current.ensureModels(
        "claude",
        "__local_settings_json__",
      );

      expect(getEngineModelsMock).toHaveBeenCalledOnce();
      resolveModels?.([
        {
          id: "settings-main",
          model: "kimi-for-coding",
          displayName: "kimi-for-coding",
          description: "",
          isDefault: true,
        },
      ]);
      await Promise.all([firstRequest, secondRequest]);
    });

    expect(getEngineModelsMock).toHaveBeenCalledWith("claude", {
      providerProfileId: "__local_settings_json__",
      forceRefresh: true,
    });

    await act(async () => {
      await result.current.ensureModels(
        "claude",
        "__local_settings_json__",
      );
    });

    expect(getEngineModelsMock).toHaveBeenCalledOnce();
  });

  it("does not reuse a Native local request for a Shared authoritative refresh", async () => {
    type EngineModels = Awaited<ReturnType<typeof getEngineModels>>;
    let resolveNative: ((models: EngineModels) => void) | undefined;
    let resolveShared: ((models: EngineModels) => void) | undefined;
    getEngineModelsMock
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveNative = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveShared = resolve;
          }),
      );
    const nativeHook = renderHook(() =>
      useSharedProviderTargetCatalog({
        enabled: true,
        mode: "native",
        currentProvider: "claude",
        currentProviderProfileId: null,
        currentModels: [],
        resolveProviderLabel: (provider) => provider,
        kimiDisabledReason: "source only",
      }),
    );
    const sharedHook = renderHook(() =>
      useSharedProviderTargetCatalog({
        enabled: true,
        mode: "shared",
        currentProvider: "codex",
        currentProviderProfileId: "codex-b",
        currentModels: [],
        resolveProviderLabel: (provider) => provider,
        kimiDisabledReason: "source only",
      }),
    );

    await act(async () => {
      const nativeRequest = nativeHook.result.current.ensureModels(
        "claude",
        "__local_settings_json__",
      );
      const sharedRequest = sharedHook.result.current.ensureModels(
        "claude",
        "__local_settings_json__",
      );

      expect(getEngineModelsMock).toHaveBeenCalledTimes(2);
      expect(getEngineModelsMock).toHaveBeenNthCalledWith(1, "claude", {
        providerProfileId: "__local_settings_json__",
      });
      expect(getEngineModelsMock).toHaveBeenNthCalledWith(2, "claude", {
        providerProfileId: "__local_settings_json__",
        forceRefresh: true,
      });
      resolveNative?.([]);
      resolveShared?.([]);
      await Promise.all([nativeRequest, sharedRequest]);
    });
  });

  it("keeps other CLIs usable when one Provider catalog fails", async () => {
    getKimiProvidersMock.mockRejectedValueOnce(new Error("kimi unavailable"));
    const { result } = renderHook(() =>
      useSharedProviderTargetCatalog({
        enabled: true,
        mode: "shared",
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
    ).toEqual([]);
    expect(
      result.current.groups.find((group) => group.providerId === "kimi")
        ?.profiles,
    ).toEqual([
      expect.objectContaining({ id: "__local_config_toml__" }),
    ]);
  });

  it("does not project global engine models into a Shared Provider binding", async () => {
    const { result } = renderHook(() =>
      useSharedProviderTargetCatalog({
        enabled: true,
        mode: "shared",
        currentProvider: "codex",
        currentProviderProfileId: "codex-b",
        currentModels: [
          {
            id: "kimi-catalog-entry",
            model: "kimi-for-coding",
            label: "Stale global Kimi model",
          },
        ],
        resolveProviderLabel: (provider) => provider,
        kimiDisabledReason: "source only",
      }),
    );

    await act(async () => {
      await result.current.ensureProfiles();
    });

    const currentProfileBeforeLoad = result.current.groups
      .find((group) => group.providerId === "codex")
      ?.profiles.find((profile) => profile.id === "codex-b");
    expect(currentProfileBeforeLoad?.models).toEqual([]);

    await act(async () => {
      await result.current.ensureModels("codex", "codex-b");
    });

    const currentProfileAfterLoad = result.current.groups
      .find((group) => group.providerId === "codex")
      ?.profiles.find((profile) => profile.id === "codex-b");
    expect(currentProfileAfterLoad?.models).toEqual([
      expect.objectContaining({ id: "same-model", label: "Scoped model" }),
    ]);
    expect(currentProfileAfterLoad?.models).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ model: "kimi-for-coding" }),
      ]),
    );
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

  it("projects only the current CLI in native mode", async () => {
    const { result } = renderHook(() =>
      useSharedProviderTargetCatalog({
        enabled: true,
        mode: "native",
        currentProvider: "codex",
        currentProviderProfileId: "codex-b",
        currentModels: [{ id: "current-model", label: "Current model" }],
        resolveProviderLabel: (provider) => provider,
        kimiDisabledReason: "source only",
      }),
    );

    await act(async () => {
      await result.current.ensureProfiles();
    });

    expect(result.current.groups).toHaveLength(1);
    expect(result.current.groups[0]).toMatchObject({
      providerId: "codex",
      enabled: true,
      profiles: expect.arrayContaining([
        expect.objectContaining({
          id: "codex-b",
          models: [{ id: "current-model", label: "Current model" }],
        }),
      ]),
    });
  });

  it("keeps only the current Kimi profile selectable in native mode", async () => {
    const { result } = renderHook(() =>
      useSharedProviderTargetCatalog({
        enabled: true,
        mode: "native",
        currentProvider: "kimi",
        currentProviderProfileId: "kimi-c",
        currentModels: [{ id: "kimi-model", label: "Kimi model" }],
        resolveProviderLabel: (provider) => provider,
        kimiDisabledReason: "source only",
      }),
    );

    await act(async () => {
      await result.current.ensureProfiles();
    });

    const kimiGroup = result.current.groups[0];
    expect(kimiGroup).toMatchObject({ providerId: "kimi", enabled: true });
    expect(
      kimiGroup?.profiles.find((profile) => profile.id === "kimi-c"),
    ).toMatchObject({ enabled: true });
    expect(
      kimiGroup?.profiles.find(
        (profile) => profile.id === "__local_config_toml__",
      ),
    ).toMatchObject({ enabled: false, disabledReason: "source only" });
  });

  it("reloads only the configured slice and preserves current custom models", async () => {
    const { result } = renderHook(() =>
      useSharedProviderTargetCatalog({
        enabled: true,
        mode: "native",
        workspaceId: "ws-1",
        currentProvider: "codex",
        currentProviderProfileId: "codex-b",
        currentModels: [
          { id: "custom-model", label: "Custom", source: "custom" },
          { id: "stale-model", label: "Stale", source: "provider-config" },
        ],
        resolveProviderLabel: (provider) => provider,
        kimiDisabledReason: "source only",
      }),
    );
    getEngineModelsMock.mockResolvedValueOnce([
      {
        id: "configured-model",
        displayName: "Configured",
        description: "",
        isDefault: true,
      },
    ]);

    await act(async () => {
      await result.current.ensureProfiles();
      await result.current.reloadConfig("codex", "codex-b");
    });

    expect(getEngineModelsMock).toHaveBeenLastCalledWith("codex", {
      providerProfileId: "codex-b",
      forceRefresh: true,
    });
    expect(result.current.groups[0]?.profiles.find(
      (profile) => profile.id === "codex-b",
    )?.models).toEqual([
      expect.objectContaining({ id: "custom-model" }),
      expect.objectContaining({ id: "configured-model" }),
    ]);
  });

  it("keeps the last-good models when config reload fails", async () => {
    getEngineModelsMock.mockResolvedValueOnce([
      {
        id: "last-good",
        model: "last-good-runtime",
        displayName: "Last Good",
        description: "",
        isDefault: true,
      },
    ]);
    const { result } = renderHook(() =>
      useSharedProviderTargetCatalog({
        enabled: true,
        mode: "shared",
        workspaceId: "ws-1",
        currentProvider: "codex",
        currentProviderProfileId: "codex-b",
        currentModels: [],
        resolveProviderLabel: (provider) => provider,
        kimiDisabledReason: "source only",
      }),
    );

    await act(async () => {
      await result.current.ensureProfiles();
      await result.current.ensureModels("codex", "codex-b");
    });
    getEngineModelsMock.mockRejectedValueOnce(new Error("reload failed"));
    await act(async () => {
      await result.current.reloadConfig("codex", "codex-b");
    });

    const profile = result.current.groups
      .find((group) => group.providerId === "codex")
      ?.profiles.find((candidate) => candidate.id === "codex-b");
    expect(profile?.models).toEqual([
      expect.objectContaining({ id: "last-good" }),
    ]);
    expect(profile?.error).toBe("reload failed");
  });

  it("discovers Codex models through the scoped CLI runtime and merges them", async () => {
    discoverCodexModelsMock.mockResolvedValueOnce({
      data: [
        {
          id: "runtime-model",
          model: "runtime-model",
          displayName: "Runtime Model",
        },
      ],
    });
    const { result } = renderHook(() =>
      useSharedProviderTargetCatalog({
        enabled: true,
        mode: "native",
        workspaceId: "ws-1",
        currentProvider: "codex",
        currentProviderProfileId: "codex-b",
        currentModels: [{ id: "custom-model", label: "Custom", source: "custom" }],
        resolveProviderLabel: (provider) => provider,
        kimiDisabledReason: "source only",
      }),
    );

    await act(async () => {
      await result.current.ensureProfiles();
      await result.current.discoverModels("codex", "codex-b");
    });

    expect(discoverCodexModelsMock).toHaveBeenCalledWith("ws-1", "codex-b");
    expect(result.current.groups[0]?.profiles.find(
      (profile) => profile.id === "codex-b",
    )?.models).toEqual([
      expect.objectContaining({ id: "custom-model" }),
      expect.objectContaining({ id: "runtime-model", source: "runtime" }),
    ]);
  });
});
