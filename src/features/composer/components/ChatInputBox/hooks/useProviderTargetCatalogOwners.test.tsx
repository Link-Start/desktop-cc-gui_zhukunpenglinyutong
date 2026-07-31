// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  isProviderProfileEngine,
  resetProviderTargetCatalogForTests,
  useAtomicProviderTargetCatalog,
  useNativeProviderTargetCatalog,
} from "./useProviderTargetCatalogOwners";
import { buildProviderExecutionTarget } from "../selectors/ModelSelect";
import { seedCliEngineVisibility } from "../../../hooks/cliEngineVisibilityStore";
import { isResolvedExecutionTarget } from "../../../../shared-session/target/types";
import {
  discoverCodexModels,
  getClaudeProviders,
  getCodexProviders,
  getEngineModels,
  getGrokProviders,
  getKimiProviders,
  getOpenCodeProviders,
} from "../../../../../services/tauri";

vi.mock("../../../../../services/tauri", () => ({
  discoverCodexModels: vi.fn(),
  getClaudeProviders: vi.fn(),
  getCodexProviders: vi.fn(),
  getKimiProviders: vi.fn(),
  getGrokProviders: vi.fn(),
  getOpenCodeProviders: vi.fn(),
  getEngineModels: vi.fn(),
}));

const getClaudeProvidersMock = vi.mocked(getClaudeProviders);
const getCodexProvidersMock = vi.mocked(getCodexProviders);
const getKimiProvidersMock = vi.mocked(getKimiProviders);
const getGrokProvidersMock = vi.mocked(getGrokProviders);
const getOpenCodeProvidersMock = vi.mocked(getOpenCodeProviders);
const getEngineModelsMock = vi.mocked(getEngineModels);
const discoverCodexModelsMock = vi.mocked(discoverCodexModels);

describe("Provider target catalog owners", () => {
  beforeEach(() => {
    resetProviderTargetCatalogForTests();
    seedCliEngineVisibility([]);
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
    getGrokProvidersMock.mockResolvedValue([
      {
        id: "grok-d",
        name: "Grok D",
        baseUrl: "",
        apiKey: "",
        model: "",
      },
    ]);
    getOpenCodeProvidersMock.mockResolvedValue([
      {
        id: "opencode-e",
        name: "OpenCode E",
        baseUrl: "",
        apiKey: "",
        models: [],
      },
    ]);
    getEngineModelsMock.mockResolvedValue([
      {
        id: "same-model",
        displayName: "Scoped model",
        description: "",
        isDefault: true,
        providerProfileId: "codex-b",
      },
    ]);
    discoverCodexModelsMock.mockResolvedValue({ data: [] });
  });

  it.each(["claude", "codex", "grok", "kimi", "opencode"])(
    "recognizes %s as a Provider Profile engine",
    (engine) => {
      expect(isProviderProfileEngine(engine)).toBe(true);
    },
  );

  it("keeps Gemini outside the Provider Profile picker", () => {
    expect(isProviderProfileEngine("gemini")).toBe(false);
  });

  it("loads profiles once and models only for the opened binding", async () => {
    const { result } = renderHook(() =>
      useAtomicProviderTargetCatalog({
        enabled: true,
        mode: "shared",
        currentProvider: "claude",
        currentProviderProfileId: "claude-a",
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
    expect(result.current.groups.map((group) => group.providerId)).toEqual([
      "claude",
      "codex",
      "grok",
      "kimi",
      "opencode",
    ]);
    expect(
      result.current.groups.filter((group) => group.enabled),
    ).toHaveLength(5);
    expect(
      result.current.groups.flatMap((group) => group.profiles).every(
        (profile) => profile.enabled !== false,
      ),
    ).toBe(true);

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

  it.each([
    ["kimi", "kimi-c"],
    ["grok", "grok-d"],
    ["opencode", "opencode-e"],
  ] as const)(
    "loads %s models from the selected Provider binding",
    async (engine, providerProfileId) => {
      getEngineModelsMock.mockResolvedValueOnce([
        {
          id: `${engine}-model`,
          model: `${engine}-runtime`,
          displayName: `${engine} model`,
          description: "",
          isDefault: true,
          providerProfileId,
        },
      ]);
      const { result } = renderHook(() =>
        useAtomicProviderTargetCatalog({
          enabled: true,
          mode: "shared",
          currentProvider: engine,
          currentProviderProfileId: providerProfileId,
          resolveProviderLabel: (provider) => provider,
          kimiDisabledReason: "source only",
        }),
      );

      await act(async () => {
        await result.current.ensureProfiles();
        await result.current.ensureModels(engine, providerProfileId);
      });

      expect(getEngineModelsMock).toHaveBeenCalledWith(engine, {
        providerProfileId,
      });
      expect(
        result.current.groups
          .find((group) => group.providerId === engine)
          ?.profiles.find((profile) => profile.id === providerProfileId)
          ?.models,
      ).toEqual([
        expect.objectContaining({
          id: `${engine}-model`,
          model: `${engine}-runtime`,
        }),
      ]);
    },
  );

  it("exposes the same five CLI groups on Home create-session", async () => {
    const { result } = renderHook(() =>
      useAtomicProviderTargetCatalog({
        enabled: true,
        mode: "create-session",
        currentProvider: "opencode",
        currentProviderProfileId: "opencode-e",
        resolveProviderLabel: (provider) => provider,
        kimiDisabledReason: "native only",
      }),
    );

    await act(async () => {
      await result.current.ensureProfiles();
    });

    expect(result.current.groups.map((group) => group.providerId)).toEqual([
      "claude",
      "codex",
      "grok",
      "kimi",
      "opencode",
    ]);
    expect(result.current.groups.every((group) => group.enabled)).toBe(true);
  });

  it("preserves a backend-returned Claude Local profile and produces a resolved model target", async () => {
    getClaudeProvidersMock.mockResolvedValueOnce([
      {
        id: "__local_settings_json__",
        name: "本地配置",
        isLocalProvider: true,
      },
      { id: "minimax-m3", name: "Minimax-m3" },
    ]);
    const { result } = renderHook(() =>
      useAtomicProviderTargetCatalog({
        enabled: true,
        mode: "create-session",
        currentProvider: "claude",
        currentProviderProfileId: "minimax-m3",
        resolveProviderLabel: (provider) => provider,
        kimiDisabledReason: "source only",
      }),
    );

    await act(async () => {
      await result.current.ensureProfiles();
    });

    const claudeProfiles = result.current.groups.find(
      (group) => group.providerId === "claude",
    )?.profiles;
    const localProfile = claudeProfiles?.find(
      (profile) => profile.id === "__local_settings_json__",
    );
    expect(
      localProfile,
    ).toMatchObject({
      label: "本地配置",
      source: "disk",
    });
    expect(
      claudeProfiles?.find((profile) => profile.id === "minimax-m3"),
    ).toMatchObject({
      label: "Minimax-m3",
      source: "managed",
    });

    const selectedLocalTarget = buildProviderExecutionTarget(
      {
        engine: "claude",
        providerProfileId: "minimax-m3",
        modelCatalogEntryId: "managed-main",
        model: "managed-main",
        providerProfileNameSnapshot: "Minimax-m3",
        providerProfileSource: "managed",
      },
      "claude",
      localProfile!.id,
      "settings-main",
      localProfile!.label,
      localProfile!.source,
      true,
      "kimi-for-coding",
    );
    expect(selectedLocalTarget).toMatchObject({
      engine: "claude",
      providerProfileId: null,
      modelCatalogEntryId: "settings-main",
      model: "kimi-for-coding",
      providerProfileSource: "disk",
    });
    expect(isResolvedExecutionTarget(selectedLocalTarget)).toBe(true);
  });

  it("keeps Native Local rows out of Home managed Profiles while preserving public fallback", async () => {
    getClaudeProvidersMock.mockResolvedValueOnce([
      { id: "minimax-m3", name: "Minimax-m3" },
    ]);
    getEngineModelsMock
      .mockResolvedValueOnce([
        {
          id: "local-scoped",
          model: "local-scoped-runtime",
          displayName: "Local scoped",
          description: "",
          isDefault: true,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "minimax-scoped",
          model: "minimax-runtime",
          displayName: "Minimax scoped",
          description: "",
          isDefault: true,
          providerProfileId: "minimax-m3",
        },
        {
          id: "leaked-local",
          model: "kimi-for-coding",
          displayName: "Leaked local",
          description: "",
          isDefault: false,
          providerProfileId: null,
          source: "settings-override",
        },
        {
          id: "public-builtin",
          model: "claude-sonnet-5",
          displayName: "Sonnet 5",
          description: "",
          isDefault: false,
          providerProfileId: null,
          source: "builtin",
        },
      ]);
    const { result } = renderHook(() =>
      useAtomicProviderTargetCatalog({
        enabled: true,
        mode: "create-session",
        currentProvider: "claude",
        currentProviderProfileId: "minimax-m3",
        resolveProviderLabel: (provider) => provider,
        kimiDisabledReason: "source only",
      }),
    );

    await act(async () => {
      await result.current.ensureProfiles();
    });

    expect(
      result.current.groups
        .find((group) => group.providerId === "claude")
        ?.profiles.find(
          (profile) => profile.id === "__local_settings_json__",
        )?.models,
    ).toEqual([]);

    await act(async () => {
      await result.current.ensureModels(
        "claude",
        "__local_settings_json__",
      );
      await result.current.ensureModels("claude", "minimax-m3");
    });

    expect(getEngineModelsMock).toHaveBeenCalledWith("claude", {
      providerProfileId: "__local_settings_json__",
    });
    expect(
      result.current.groups
        .find((group) => group.providerId === "claude")
        ?.profiles.find(
          (profile) => profile.id === "__local_settings_json__",
        ),
    ).toMatchObject({
      loading: false,
      models: [
        expect.objectContaining({
          id: "local-scoped",
          model: "local-scoped-runtime",
        }),
      ],
    });
    expect(
      result.current.groups
        .find((group) => group.providerId === "claude")
        ?.profiles.find((profile) => profile.id === "minimax-m3")
        ?.models,
    ).toEqual([
      expect.objectContaining({
        id: "minimax-scoped",
        model: "minimax-runtime",
      }),
      expect.objectContaining({
        id: "public-builtin",
        model: "claude-sonnet-5",
        source: "builtin",
      }),
    ]);
    expect(
      result.current.groups
        .find((group) => group.providerId === "claude")
        ?.profiles.find((profile) => profile.id === "minimax-m3")
        ?.models,
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ model: "kimi-for-coding" }),
      ]),
    );
  });

  it("keeps public fallback rows available in the Native owner", async () => {
    getEngineModelsMock.mockResolvedValueOnce([
      {
        id: "provider-scoped",
        model: "provider-runtime",
        displayName: "Provider scoped",
        description: "",
        isDefault: true,
        providerProfileId: "codex-b",
      },
      {
        id: "public-fallback",
        model: "public-runtime",
        displayName: "Public fallback",
        description: "",
        isDefault: false,
        providerProfileId: null,
      },
    ]);
    const { result } = renderHook(() =>
      useNativeProviderTargetCatalog({
        enabled: true,
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

    expect(
      result.current.groups[0]?.profiles.find(
        (profile) => profile.id === "codex-b",
      )?.models,
    ).toEqual([
      expect.objectContaining({ id: "provider-scoped" }),
      expect.objectContaining({ id: "public-fallback" }),
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
      useAtomicProviderTargetCatalog({
        enabled: true,
        mode: "shared",
        currentProvider: "codex",
        currentProviderProfileId: "codex-b",
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
      useAtomicProviderTargetCatalog({
        enabled: true,
        mode: "shared",
        currentProvider: "codex",
        currentProviderProfileId: "codex-b",
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
      useAtomicProviderTargetCatalog({
        enabled: true,
        mode: "shared",
        currentProvider: "codex",
        currentProviderProfileId: "codex-b",
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
      useNativeProviderTargetCatalog({
        enabled: true,
        currentProvider: "claude",
        currentProviderProfileId: null,
        currentModels: [],
        resolveProviderLabel: (provider) => provider,
        kimiDisabledReason: "source only",
      }),
    );
    const sharedHook = renderHook(() =>
      useAtomicProviderTargetCatalog({
        enabled: true,
        mode: "shared",
        currentProvider: "codex",
        currentProviderProfileId: "codex-b",
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
      useAtomicProviderTargetCatalog({
        enabled: true,
        mode: "shared",
        currentProvider: "claude",
        currentProviderProfileId: null,
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
      useAtomicProviderTargetCatalog({
        enabled: true,
        mode: "shared",
        currentProvider: "codex",
        currentProviderProfileId: "codex-b",
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
      useAtomicProviderTargetCatalog({
        enabled: true,
        mode: "shared",
        currentProvider: "claude",
        currentProviderProfileId: "claude-a",
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
      useNativeProviderTargetCatalog({
        enabled: true,
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
      useNativeProviderTargetCatalog({
        enabled: true,
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

  it.each([
    ["grok", "grok-d"],
    ["opencode", "opencode-e"],
  ] as const)(
    "scopes a native %s session to its current CLI provider group",
    async (engine, providerProfileId) => {
      const currentModel = {
        id: `${engine}-current`,
        label: `${engine} current`,
      };
      const { result } = renderHook(() =>
        useNativeProviderTargetCatalog({
          enabled: true,
          currentProvider: engine,
          currentProviderProfileId: providerProfileId,
          currentModels: [currentModel],
          resolveProviderLabel: (provider) => provider,
          kimiDisabledReason: "source only",
        }),
      );

      await act(async () => {
        await result.current.ensureProfiles();
      });

      expect(result.current.groups.map((group) => group.providerId)).toEqual([
        engine,
      ]);
      expect(
        result.current.groups[0]?.profiles.find(
          (profile) => profile.id === providerProfileId,
        )?.models,
      ).toEqual([currentModel]);
    },
  );

  it("merges plugin custom models into atomic engine groups without session currentModels", async () => {
    const { result } = renderHook(() =>
      useAtomicProviderTargetCatalog({
        enabled: true,
        mode: "shared",
        currentProvider: "claude",
        currentProviderProfileId: null,
        pluginCustomModels: {
          claude: [
            { id: "my-custom", label: "My Custom", source: "custom" },
          ],
        },
        resolveProviderLabel: (provider) => provider,
        kimiDisabledReason: "source only",
      }),
    );

    await act(async () => {
      await result.current.ensureProfiles();
      await result.current.ensureModels("claude", "__local_settings_json__");
    });

    const claudeLocal = result.current.groups
      .find((group) => group.providerId === "claude")
      ?.profiles.find((profile) => profile.id === "__local_settings_json__");
    expect(claudeLocal?.models.some((model) => model.id === "my-custom")).toBe(
      true,
    );
  });

  it("reloads only the configured slice and preserves current custom models", async () => {
    const { result } = renderHook(() =>
      useNativeProviderTargetCatalog({
        enabled: true,
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
        providerProfileId: "codex-b",
      },
    ]);
    const { result } = renderHook(() =>
      useAtomicProviderTargetCatalog({
        enabled: true,
        mode: "shared",
        workspaceId: "ws-1",
        currentProvider: "codex",
        currentProviderProfileId: "codex-b",
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
      useNativeProviderTargetCatalog({
        enabled: true,
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

  describe("CLI engine visibility", () => {
    it("hides user-disabled engines from the shared picker groups", () => {
      seedCliEngineVisibility(["grok", "opencode"]);

      const { result } = renderHook(() =>
        useAtomicProviderTargetCatalog({
          enabled: true,
          mode: "shared",
          currentProvider: "claude",
          currentProviderProfileId: null,
          resolveProviderLabel: (provider) => provider,
          kimiDisabledReason: "source only",
        }),
      );

      expect(result.current.groups.map((group) => group.providerId)).toEqual([
        "claude",
        "codex",
        "kimi",
      ]);
    });

    it("keeps the current provider visible even when user-disabled", () => {
      seedCliEngineVisibility(["grok"]);

      const { result } = renderHook(() =>
        useAtomicProviderTargetCatalog({
          enabled: true,
          mode: "shared",
          currentProvider: "grok",
          currentProviderProfileId: "grok-d",
          resolveProviderLabel: (provider) => provider,
          kimiDisabledReason: "source only",
        }),
      );

      expect(result.current.groups.map((group) => group.providerId)).toEqual([
        "claude",
        "codex",
        "grok",
        "kimi",
        "opencode",
      ]);
    });

    it("updates groups when the visibility setting changes at runtime", () => {
      const { result } = renderHook(() =>
        useAtomicProviderTargetCatalog({
          enabled: true,
          mode: "shared",
          currentProvider: "claude",
          currentProviderProfileId: null,
          resolveProviderLabel: (provider) => provider,
          kimiDisabledReason: "source only",
        }),
      );

      expect(result.current.groups).toHaveLength(5);

      act(() => {
        seedCliEngineVisibility(["opencode"]);
      });

      expect(result.current.groups.map((group) => group.providerId)).toEqual([
        "claude",
        "codex",
        "grok",
        "kimi",
      ]);
    });
  });
});
