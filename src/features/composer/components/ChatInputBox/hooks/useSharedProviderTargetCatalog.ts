import { useCallback, useMemo, useState } from "react";

import {
  getClaudeProviders,
  getCodexProviders,
  getEngineModels,
  getKimiProviders,
} from "../../../../../services/tauri";
import type { EngineType } from "../../../../../types";
import {
  CLAUDE_LOCAL_PROVIDER_PROFILE_ID,
  CLAUDE_LOCAL_PROVIDER_PROFILE_NAME,
  CODEX_DISK_PROVIDER_PROFILE_ID,
  CODEX_DISK_PROVIDER_PROFILE_NAME,
  KIMI_LOCAL_PROVIDER_PROFILE_ID,
  KIMI_LOCAL_PROVIDER_PROFILE_NAME,
  type EngineProviderProfileOption,
} from "../../../../threads/constants/codexProviderProfiles";
import type { ModelInfo, ProviderId } from "../types";

export type ProviderProfileModelGroup = {
  id: string;
  label: string;
  source: "disk" | "managed";
  enabled?: boolean;
  disabledReason?: string;
  models: ModelInfo[];
  loading: boolean;
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
  Record<"claude" | "codex" | "kimi", EngineProviderProfileOption[]>
>;

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
};

let profileCatalogCache: ProfileCatalog | null = null;
let profileCatalogRequest: Promise<ProfileCatalog> | null = null;
const modelCatalogCache = new Map<string, ModelInfo[]>();
const modelCatalogRequests = new Map<string, Promise<ModelInfo[]>>();

function isCurrentProviderProfile(
  engine: "claude" | "codex" | "kimi",
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
  engine: "claude" | "codex" | "kimi",
  providers: Array<{ id: string; name: string }>,
): EngineProviderProfileOption[] {
  const normalized = providers
    .map((provider) => ({
      id: provider.id.trim(),
      name: provider.name.trim() || provider.id.trim(),
      source: "managed" as const,
    }))
    .filter((provider) => provider.id.length > 0);
  const defaults = DEFAULT_PROFILES[engine] ?? [];
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
    ])
      .then(([claude, codex, kimi]) => {
        if (
          claude.status === "rejected" &&
          codex.status === "rejected" &&
          kimi.status === "rejected"
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

export function useSharedProviderTargetCatalog({
  enabled,
  mode = "shared",
  currentProvider,
  currentProviderProfileId,
  currentModels,
  resolveProviderLabel,
  kimiDisabledReason,
}: {
  enabled: boolean;
  mode?: "shared" | "native";
  currentProvider: ProviderId;
  currentProviderProfileId?: string | null;
  currentModels: ModelInfo[];
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
  const [loadedModels, setLoadedModels] = useState<Record<string, ModelInfo[]>>(
    () => Object.fromEntries(modelCatalogCache),
  );

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
      if (!enabled || (engine !== "claude" && engine !== "codex")) {
        return;
      }
      const key = modelCatalogKey(engine, providerProfileId);
      const cachedModels = modelCatalogCache.get(key);
      if (cachedModels) {
        setLoadedModels((current) =>
          current[key] ? current : { ...current, [key]: cachedModels },
        );
        return;
      }
      setLoadingBindings((current) => new Set(current).add(key));
      setModelErrors((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      try {
        let request = modelCatalogRequests.get(key);
        if (!request) {
          request = getEngineModels(engine, { providerProfileId })
            .then((models) => models.map(toModelInfo))
            .finally(() => {
              modelCatalogRequests.delete(key);
            });
          modelCatalogRequests.set(key, request);
        }
        const models = await request;
        modelCatalogCache.set(key, models);
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
    [enabled],
  );

  const groups = useMemo<ProviderTargetGroup[]>(() => {
    if (!enabled) {
      return [];
    }
    const supportedEngines: Array<"claude" | "codex" | "kimi"> = [
      "claude", "codex", "kimi",
    ];
    const engines =
      mode === "native" && supportedEngines.includes(
        currentProvider as "claude" | "codex" | "kimi",
      )
        ? [currentProvider as "claude" | "codex" | "kimi"]
        : supportedEngines;
    return engines.map((engine) => ({
      providerId: engine,
      providerLabel: resolveProviderLabel(engine),
      enabled: mode === "native" || engine !== "kimi",
      disabledReason:
        mode === "shared" && engine === "kimi"
          ? kimiDisabledReason
          : undefined,
      profiles: (profiles[engine] ?? []).map((profile) => {
        const key = modelCatalogKey(engine, profile.id);
        const isCurrentBinding =
          currentProvider === engine &&
          isCurrentProviderProfile(
            engine,
            profile.id,
            currentProviderProfileId,
          );
        return {
          id: profile.id,
          label: profile.name,
          source: profile.source,
          enabled: engine !== "kimi" || isCurrentBinding,
          disabledReason:
            engine === "kimi" && !isCurrentBinding
              ? kimiDisabledReason
              : undefined,
          models:
            loadedModels[key] ??
            modelCatalogCache.get(key) ??
            (isCurrentBinding ? currentModels : []),
          loading: loadingBindings.has(key),
          error: modelErrors[key] ?? null,
        };
      }),
    }));
  }, [
    currentModels,
    currentProvider,
    currentProviderProfileId,
    enabled,
    kimiDisabledReason,
    loadedModels,
    loadingBindings,
    modelErrors,
    mode,
    profiles,
    resolveProviderLabel,
  ]);

  return {
    groups,
    ensureProfiles,
    ensureModels,
    profileLoadError,
  };
}

export function resetSharedProviderTargetCatalogForTests(): void {
  profileCatalogCache = null;
  profileCatalogRequest = null;
  modelCatalogCache.clear();
  modelCatalogRequests.clear();
}
