import { useCallback, useMemo, useRef, useState } from "react";

import {
  discoverCodexModels,
  getClaudeProviders,
  getCodexProviders,
  getEngineModels,
  getGrokProviders,
  getKimiProviders,
  getOpenCodeProviders,
} from "../../../../../services/tauri";
import type { EngineType } from "../../../../../types";
import {
  CLAUDE_LOCAL_PROVIDER_PROFILE_ID,
  CLAUDE_LOCAL_PROVIDER_PROFILE_NAME,
  CODEX_DISK_PROVIDER_PROFILE_ID,
  CODEX_DISK_PROVIDER_PROFILE_NAME,
  GROK_LOCAL_PROVIDER_PROFILE_ID,
  GROK_LOCAL_PROVIDER_PROFILE_NAME,
  KIMI_LOCAL_PROVIDER_PROFILE_ID,
  KIMI_LOCAL_PROVIDER_PROFILE_NAME,
  OPENCODE_LOCAL_PROVIDER_PROFILE_ID,
  OPENCODE_LOCAL_PROVIDER_PROFILE_NAME,
  type EngineProviderProfileOption,
} from "../../../../threads/constants/codexProviderProfiles";
import type { ModelInfo, ProviderId } from "../types";
import { useCliEngineVisibility } from "../../../hooks/cliEngineVisibilityStore";

// Native 单栏与 Atomic 双栏共享不可变 cache primitives，但拥有独立 hook state/input contract。
export type ProviderProfileModelGroup = {
  id: string;
  label: string;
  source: "disk" | "managed";
  enabled?: boolean;
  disabledReason?: string;
  models: ModelInfo[];
  loading: boolean;
  reloadingConfig?: boolean;
  discoveringModels?: boolean;
  discoverySupported?: boolean;
  error: string | null;
};

export type ProviderTargetGroup = {
  providerId: ProviderId;
  providerLabel: string;
  enabled: boolean;
  disabledReason?: string;
  profiles: ProviderProfileModelGroup[];
};

type ProfileCatalog = Partial<
  Record<
    "claude" | "codex" | "kimi" | "grok" | "opencode",
    EngineProviderProfileOption[]
  >
>;

type ProviderProfileEngine = Exclude<ProviderId, "gemini">;

const PROVIDER_PROFILE_ENGINES: readonly ProviderProfileEngine[] = [
  "claude",
  "codex",
  "grok",
  "kimi",
  "opencode",
];

export function isProviderProfileEngine(
  provider: string,
): provider is ProviderProfileEngine {
  return PROVIDER_PROFILE_ENGINES.some((engine) => engine === provider);
}

const DEFAULT_PROFILES: ProfileCatalog = {
  claude: [
    {
      id: CLAUDE_LOCAL_PROVIDER_PROFILE_ID,
      name: CLAUDE_LOCAL_PROVIDER_PROFILE_NAME,
      source: "disk",
    },
  ],
  codex: [
    {
      id: CODEX_DISK_PROVIDER_PROFILE_ID,
      name: CODEX_DISK_PROVIDER_PROFILE_NAME,
      source: "disk",
    },
  ],
  kimi: [
    {
      id: KIMI_LOCAL_PROVIDER_PROFILE_ID,
      name: KIMI_LOCAL_PROVIDER_PROFILE_NAME,
      source: "disk",
    },
  ],
  grok: [
    {
      id: GROK_LOCAL_PROVIDER_PROFILE_ID,
      name: GROK_LOCAL_PROVIDER_PROFILE_NAME,
      source: "disk",
    },
  ],
  opencode: [
    {
      id: OPENCODE_LOCAL_PROVIDER_PROFILE_ID,
      name: OPENCODE_LOCAL_PROVIDER_PROFILE_NAME,
      source: "disk",
    },
  ],
};

let profileCatalogCache: ProfileCatalog | null = null;
let profileCatalogRequest: Promise<ProfileCatalog> | null = null;
const modelCatalogCache = new Map<string, ModelInfo[]>();
const modelCatalogRequests = new Map<string, Promise<ModelInfo[]>>();
const discoveredModelCatalogCache = new Map<string, ModelInfo[]>();
const EMPTY_MODELS: ModelInfo[] = [];

type CatalogAction = "reload-config" | "discover-models";
type AtomicProviderTargetCatalogMode = "shared" | "create-session";

type ProviderTargetCatalogCommonOptions = {
  enabled: boolean;
  workspaceId?: string | null;
  currentProvider: ProviderId;
  currentProviderProfileId?: string | null;
  resolveProviderLabel: (providerId: ProviderId) => string;
  kimiDisabledReason: string;
};

/** 自定义模型按引擎注入(localStorage plugin models),与 session currentModels 解耦 */
export type PluginCustomModelsByEngine = Partial<
  Record<"claude" | "codex" | "gemini", ModelInfo[]>
>;

type AtomicProviderTargetCatalogOptions =
  ProviderTargetCatalogCommonOptions & {
    mode: AtomicProviderTargetCatalogMode;
    /** 各引擎 localStorage 自定义模型;添加后立即出现在 atomic 选择器 */
    pluginCustomModels?: PluginCustomModelsByEngine;
  };

type NativeProviderTargetCatalogOptions =
  ProviderTargetCatalogCommonOptions & {
    currentModels: ModelInfo[];
  };

function isCurrentProviderProfile(
  engine: "claude" | "codex" | "kimi" | "grok" | "opencode",
  profileId: string,
  currentProviderProfileId: string | null | undefined,
): boolean {
  if (currentProviderProfileId === profileId) {
    return true;
  }
  if (currentProviderProfileId?.trim()) {
    return false;
  }
  return DEFAULT_PROFILES[engine]?.[0]?.id === profileId;
}

function normalizeProfiles(
  engine: "claude" | "codex" | "kimi" | "grok" | "opencode",
  providers: Array<{
    id: string;
    name: string;
    isLocalProvider?: boolean;
  }>,
): EngineProviderProfileOption[] {
  const defaults = DEFAULT_PROFILES[engine] ?? [];
  const defaultNameById = new Map(
    defaults.map((profile) => [profile.id, profile.name]),
  );
  const normalized = providers
    .map((provider) => {
      const id = provider.id.trim();
      const isLocal =
        provider.isLocalProvider || isLocalProviderProfile(engine, id);
      // 本地渠道统一展示「本地配置」，避免暴露 settings.json / codex-tui 等内部路径
      const name = isLocal
        ? (defaultNameById.get(id) ??
          defaults[0]?.name ??
          (provider.name.trim() || id))
        : provider.name.trim() || id;
      return {
        id,
        name,
        source: isLocal ? ("disk" as const) : ("managed" as const),
      };
    })
    .filter((provider) => provider.id.length > 0);
  return [
    ...defaults.filter(
      (defaultProfile) =>
        !normalized.some((provider) => provider.id === defaultProfile.id),
    ),
    ...normalized,
  ];
}

async function loadProfileCatalog(): Promise<ProfileCatalog> {
  if (profileCatalogCache) {
    return profileCatalogCache;
  }
  if (!profileCatalogRequest) {
    profileCatalogRequest = Promise.allSettled([
      getClaudeProviders(),
      getCodexProviders(),
      getKimiProviders(),
      getGrokProviders(),
      getOpenCodeProviders(),
    ])
      .then(([claude, codex, kimi, grok, opencode]) => {
        if (
          claude.status === "rejected" &&
          codex.status === "rejected" &&
          kimi.status === "rejected" &&
          grok.status === "rejected" &&
          opencode.status === "rejected"
        ) {
          throw claude.reason;
        }
        profileCatalogCache = {
          claude:
            claude.status === "fulfilled"
              ? normalizeProfiles("claude", claude.value)
              : DEFAULT_PROFILES.claude,
          codex:
            codex.status === "fulfilled"
              ? normalizeProfiles("codex", codex.value)
              : DEFAULT_PROFILES.codex,
          kimi:
            kimi.status === "fulfilled"
              ? normalizeProfiles("kimi", kimi.value)
              : DEFAULT_PROFILES.kimi,
          grok:
            grok.status === "fulfilled"
              ? normalizeProfiles("grok", grok.value)
              : DEFAULT_PROFILES.grok,
          opencode:
            opencode.status === "fulfilled"
              ? normalizeProfiles("opencode", opencode.value)
              : DEFAULT_PROFILES.opencode,
        };
        return profileCatalogCache;
      })
      .finally(() => {
        profileCatalogRequest = null;
      });
  }
  return profileCatalogRequest;
}

function modelCatalogKey(engine: EngineType, providerProfileId: string): string {
  return `${engine}:${providerProfileId}`;
}

function isLocalProviderProfile(
  engine: EngineType,
  providerProfileId: string,
): boolean {
  switch (engine) {
    case "claude":
      return providerProfileId === CLAUDE_LOCAL_PROVIDER_PROFILE_ID;
    case "codex":
      return providerProfileId === CODEX_DISK_PROVIDER_PROFILE_ID;
    case "kimi":
      return providerProfileId === KIMI_LOCAL_PROVIDER_PROFILE_ID;
    case "grok":
      return providerProfileId === GROK_LOCAL_PROVIDER_PROFILE_ID;
    case "opencode":
      return providerProfileId === OPENCODE_LOCAL_PROVIDER_PROFILE_ID;
    default:
      return false;
  }
}

function initialLoadedModels(
  mode: "shared" | "native" | "create-session",
): Record<string, ModelInfo[]> {
  if (mode !== "shared") {
    return Object.fromEntries(modelCatalogCache);
  }
  return Object.fromEntries(
    [...modelCatalogCache].filter(([key]) => {
      const separatorIndex = key.indexOf(":");
      if (separatorIndex < 0) {
        return true;
      }
      return !isLocalProviderProfile(
        key.slice(0, separatorIndex) as EngineType,
        key.slice(separatorIndex + 1),
      );
    }),
  );
}

function toModelInfo(
  model: Awaited<ReturnType<typeof getEngineModels>>[number],
): ModelInfo {
  return {
    id: model.id,
    model: model.model,
    label: model.displayName || model.id,
    description: model.description,
    source: model.source,
    providerProfileId: model.providerProfileId ?? undefined,
  };
}

function modelRuntimeIdentity(model: ModelInfo): string {
  return (model.model?.trim() || model.id.trim()).toLowerCase();
}

/**
 * Prefer stable catalog entry id so Claude family tiers that share the same
 * mapped runtime model (e.g. all → kimi-k3) stay as separate picker rows.
 */
function modelCatalogIdentity(model: ModelInfo): string {
  const id = model.id.trim().toLowerCase();
  if (id) {
    return `id:${id}`;
  }
  const runtime = modelRuntimeIdentity(model);
  return runtime ? `runtime:${runtime}` : "";
}

function isPublicFallbackModel(model: ModelInfo): boolean {
  if (model.providerProfileId?.trim()) {
    return false;
  }
  return model.source === "fallback" || model.source === "builtin";
}

export function mergeProviderCatalogModels(
  customModels: ModelInfo[],
  configuredModels: ModelInfo[],
  discoveredModels: ModelInfo[],
): ModelInfo[] {
  const merged: ModelInfo[] = [];
  const seen = new Set<string>();
  for (const model of [
    ...customModels,
    ...configuredModels,
    ...discoveredModels,
  ]) {
    const identity = modelCatalogIdentity(model);
    if (!identity || seen.has(identity)) {
      continue;
    }
    seen.add(identity);
    merged.push(model);
  }
  return merged;
}

export function filterAtomicProviderProfileModels(
  engine: EngineType,
  providerProfileId: string,
  models: ModelInfo[],
): ModelInfo[] {
  const localProfile = isLocalProviderProfile(engine, providerProfileId);
  return models.filter((model) => {
    const modelProviderProfileId = model.providerProfileId?.trim() || null;
    return localProfile
      ? modelProviderProfileId === null ||
          modelProviderProfileId === providerProfileId
      : modelProviderProfileId === providerProfileId ||
          isPublicFallbackModel(model);
  });
}

function extractCodexDiscoveredModels(response: Record<string, unknown>): ModelInfo[] {
  const result =
    response.result && typeof response.result === "object"
      ? response.result as Record<string, unknown>
      : null;
  const rawModels = result?.data ?? response.data;
  if (!Array.isArray(rawModels)) {
    return [];
  }
  return rawModels.flatMap((rawModel) => {
    if (!rawModel || typeof rawModel !== "object") {
      return [];
    }
    const model = rawModel as Record<string, unknown>;
    const idValue = model.id ?? model.model;
    if (typeof idValue !== "string" || !idValue.trim()) {
      return [];
    }
    const runtimeModel =
      typeof model.model === "string" && model.model.trim()
        ? model.model.trim()
        : idValue.trim();
    const labelValue =
      model.displayName ?? model.display_name ?? model.name ?? runtimeModel;
    return [{
      id: idValue.trim(),
      model: runtimeModel,
      label:
        typeof labelValue === "string" && labelValue.trim()
          ? labelValue.trim()
          : runtimeModel,
      description:
        typeof model.description === "string" ? model.description : undefined,
      source: "runtime",
    }];
  });
}

function useProviderTargetCatalogOwner({
  enabled,
  workspaceId,
  mode = "shared",
  currentProvider,
  currentProviderProfileId,
  currentModels,
  pluginCustomModels,
  resolveProviderLabel,
  kimiDisabledReason,
}: {
  enabled: boolean;
  workspaceId?: string | null;
  mode?: "shared" | "native" | "create-session";
  currentProvider: ProviderId;
  currentProviderProfileId?: string | null;
  currentModels: ModelInfo[];
  pluginCustomModels?: PluginCustomModelsByEngine;
  resolveProviderLabel: (providerId: ProviderId) => string;
  kimiDisabledReason: string;
}) {
  const [profiles, setProfiles] = useState<ProfileCatalog>(
    () => profileCatalogCache ?? DEFAULT_PROFILES,
  );
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);
  const [loadingBindings, setLoadingBindings] = useState<Set<string>>(
    () => new Set(),
  );
  const [modelErrors, setModelErrors] = useState<Record<string, string>>({});
  const [catalogActions, setCatalogActions] = useState<Set<string>>(
    () => new Set(),
  );
  const catalogActionsInFlight = useRef(new Set<string>());
  const authoritativeRefreshCompletedBindingsRef = useRef(new Set<string>());
  const [loadedModels, setLoadedModels] = useState<Record<string, ModelInfo[]>>(
    () => initialLoadedModels(mode),
  );
  // 用户在「CLI配置管理」停用的引擎不进 target picker;当前选中引擎兜底保留,
  // 与 ProviderSelect 的可见性规则保持一致(进行中的会话不受开关影响)。
  const disabledCliEngineIds = useCliEngineVisibility();

  const ensureProfiles = useCallback(async () => {
    if (!enabled) {
      return;
    }
    setProfileLoadError(null);
    try {
      setProfiles(await loadProfileCatalog());
    } catch (error) {
      setProfileLoadError(error instanceof Error ? error.message : String(error));
    }
  }, [enabled]);

  const ensureModels = useCallback(
    async (engine: EngineType, providerProfileId: string) => {
      if (
        !enabled ||
        !["claude", "codex", "kimi", "grok", "opencode"].includes(engine)
      ) {
        return;
      }
      const key = modelCatalogKey(engine, providerProfileId);
      const requiresAuthoritativeRefresh =
        mode === "shared" &&
        isLocalProviderProfile(engine, providerProfileId) &&
        !authoritativeRefreshCompletedBindingsRef.current.has(key);
      const cachedModels = modelCatalogCache.get(key);
      if (!requiresAuthoritativeRefresh && cachedModels) {
        setLoadedModels((current) =>
          current[key] ? current : { ...current, [key]: cachedModels },
        );
        return;
      }
      if (requiresAuthoritativeRefresh) {
        setLoadedModels((current) => {
          if (!(key in current)) {
            return current;
          }
          const next = { ...current };
          delete next[key];
          return next;
        });
      }
      setLoadingBindings((current) => new Set(current).add(key));
      setModelErrors((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      try {
        const requestKey = requiresAuthoritativeRefresh
          ? `force-refresh:${key}`
          : key;
        let request = modelCatalogRequests.get(requestKey);
        if (!request) {
          request = getEngineModels(engine, {
            providerProfileId,
            ...(requiresAuthoritativeRefresh
              ? { forceRefresh: true }
              : {}),
          })
            .then((models) => models.map(toModelInfo))
            .finally(() => {
              modelCatalogRequests.delete(requestKey);
            });
          modelCatalogRequests.set(requestKey, request);
        }
        const models = await request;
        modelCatalogCache.set(key, models);
        if (requiresAuthoritativeRefresh) {
          authoritativeRefreshCompletedBindingsRef.current.add(key);
        }
        setLoadedModels((current) => ({ ...current, [key]: models }));
      } catch (error) {
        setModelErrors((current) => ({
          ...current,
          [key]: error instanceof Error ? error.message : String(error),
        }));
      } finally {
        setLoadingBindings((current) => {
          const next = new Set(current);
          next.delete(key);
          return next;
        });
      }
    },
    [enabled, mode],
  );

  const runCatalogAction = useCallback(
    async (
      action: CatalogAction,
      engine: EngineType,
      providerProfileId: string,
    ) => {
      if (!enabled) {
        return;
      }
      const key = modelCatalogKey(engine, providerProfileId);
      const actionKey = `${action}:${key}`;
      if (catalogActionsInFlight.current.has(actionKey)) {
        return;
      }
      if (action === "discover-models" && engine !== "codex") {
        throw new Error(`${engine} CLI does not expose a supported model-list protocol`);
      }
      if (action === "discover-models" && !workspaceId?.trim()) {
        throw new Error("Codex model discovery requires an active workspace");
      }

      catalogActionsInFlight.current.add(actionKey);
      setCatalogActions((current) => new Set(current).add(actionKey));
      setModelErrors((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      try {
        if (action === "reload-config") {
          const models = (await getEngineModels(engine, {
            providerProfileId,
            forceRefresh: true,
          })).map(toModelInfo);
          modelCatalogCache.set(key, models);
          if (
            mode === "shared" &&
            isLocalProviderProfile(engine, providerProfileId)
          ) {
            authoritativeRefreshCompletedBindingsRef.current.add(key);
          }
          setLoadedModels((current) => ({ ...current, [key]: models }));
          return;
        }

        const models = extractCodexDiscoveredModels(
          await discoverCodexModels(workspaceId!.trim(), providerProfileId),
        ).map((model) => ({ ...model, providerProfileId }));
        discoveredModelCatalogCache.set(key, models);
        setLoadedModels((current) => ({ ...current }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setModelErrors((current) => ({ ...current, [key]: message }));
      } finally {
        catalogActionsInFlight.current.delete(actionKey);
        setCatalogActions((current) => {
          const next = new Set(current);
          next.delete(actionKey);
          return next;
        });
      }
    },
    [enabled, mode, workspaceId],
  );
  const reloadConfig = useCallback(
    (engine: EngineType, providerProfileId: string) =>
      runCatalogAction("reload-config", engine, providerProfileId),
    [runCatalogAction],
  );
  const discoverModels = useCallback(
    (engine: EngineType, providerProfileId: string) =>
      runCatalogAction("discover-models", engine, providerProfileId),
    [runCatalogAction],
  );

  const groups = useMemo<ProviderTargetGroup[]>(() => {
    if (!enabled) {
      return [];
    }
    const engines =
      mode === "native"
        ? isProviderProfileEngine(currentProvider)
          ? [currentProvider]
          : []
        : PROVIDER_PROFILE_ENGINES.filter(
            (engine) =>
              engine === currentProvider || !disabledCliEngineIds.has(engine),
          );
    return engines.map((engine) => ({
      providerId: engine,
      providerLabel: resolveProviderLabel(engine),
      enabled: true,
      disabledReason: undefined,
      profiles: (profiles[engine] ?? []).map((profile) => {
        const key = modelCatalogKey(engine, profile.id);
        const isCurrentBinding =
          currentProvider === engine &&
          isCurrentProviderProfile(
            engine,
            profile.id,
            currentProviderProfileId,
          );
        const canUseCurrentModels =
          mode === "native" && isCurrentBinding;
        const pluginModelsForEngine =
          engine === "claude" || engine === "codex"
            ? (pluginCustomModels?.[engine] ?? EMPTY_MODELS)
            : EMPTY_MODELS;
        // native:会话当前列表里的 custom;atomic:localStorage 插件自定义模型
        const customModels = canUseCurrentModels
          ? currentModels.filter((model) => model.source === "custom")
          : pluginModelsForEngine;
        const configuredModels =
          loadedModels[key] ??
          (mode === "shared" &&
          isLocalProviderProfile(engine, profile.id)
            ? undefined
            : modelCatalogCache.get(key)) ??
          (canUseCurrentModels ? currentModels : []);
        const mergedModels = mergeProviderCatalogModels(
          customModels,
          configuredModels,
          discoveredModelCatalogCache.get(key) ?? [],
        );
        return {
          id: profile.id,
          label: profile.name,
          source: profile.source,
          enabled:
            mode !== "native" || engine !== "kimi" || isCurrentBinding,
          disabledReason:
            mode === "native" && engine === "kimi" && !isCurrentBinding
              ? kimiDisabledReason
              : undefined,
          models:
            mode === "native"
              ? mergedModels
              : filterAtomicProviderProfileModels(
                  engine,
                  profile.id,
                  mergedModels,
                ),
          loading: loadingBindings.has(key),
          reloadingConfig: catalogActions.has(`reload-config:${key}`),
          discoveringModels: catalogActions.has(`discover-models:${key}`),
          discoverySupported: engine === "codex" && Boolean(workspaceId?.trim()),
          error: modelErrors[key] ?? null,
        };
      }),
    }));
  }, [
    currentModels,
    currentProvider,
    currentProviderProfileId,
    catalogActions,
    disabledCliEngineIds,
    enabled,
    kimiDisabledReason,
    loadedModels,
    loadingBindings,
    modelErrors,
    mode,
    pluginCustomModels,
    profiles,
    resolveProviderLabel,
    workspaceId,
  ]);

  return {
    groups,
    ensureProfiles,
    ensureModels,
    reloadConfig,
    discoverModels,
    profileLoadError,
  };
}

/**
 * Atomic 双栏 catalog owner。
 *
 * 不接收 Native session `currentModels`；引擎/渠道 catalog 仍按
 * `engine + providerProfileId` 拉取。自定义模型单独经 `pluginCustomModels`
 * 注入,保证「添加模型」后当前页选择器立刻可见。
 */
export function useAtomicProviderTargetCatalog({
  mode,
  pluginCustomModels,
  ...options
}: AtomicProviderTargetCatalogOptions) {
  return useProviderTargetCatalogOwner({
    ...options,
    mode,
    currentModels: EMPTY_MODELS,
    pluginCustomModels,
  });
}

/**
 * Native 单栏 catalog owner。
 *
 * 仅该 owner 可以投影当前 Session 的 Models，并且只投影到当前 CLI/Profile。
 */
export function useNativeProviderTargetCatalog({
  currentModels,
  ...options
}: NativeProviderTargetCatalogOptions) {
  return useProviderTargetCatalogOwner({
    ...options,
    mode: "native",
    currentModels,
  });
}

export function resetProviderTargetCatalogForTests(): void {
  profileCatalogCache = null;
  profileCatalogRequest = null;
  modelCatalogCache.clear();
  modelCatalogRequests.clear();
  discoveredModelCatalogCache.clear();
}
