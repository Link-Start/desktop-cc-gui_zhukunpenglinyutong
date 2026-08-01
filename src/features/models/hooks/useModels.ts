import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { DebugEntry, ModelOption, WorkspaceInfo } from "../../../types";
import { getConfigModel, getModelList } from "../../../services/tauri";
import {
  CODEX_MODEL_CATALOG,
  CODEX_MODEL_FALLBACK_ENTRIES,
} from "../codexModelCatalog";
import {
  createModelCatalogCache,
  mergeModelCatalogSources,
  type ModelCatalogEntry,
} from "../modelProviderCatalog";
import {
  STORAGE_KEYS as PROVIDER_STORAGE_KEYS,
  validateCodexCustomModels,
} from "../../composer/types/provider";
import { startupOrchestrator } from "../../startup-orchestration/utils/startupOrchestrator";
import {
  CUSTOM_MODEL_DEFAULT_REASONING_EFFORT,
  CUSTOM_MODEL_SUPPORTED_REASONING_OPTIONS,
} from "../customModelReasoning";

type UseModelsOptions = {
  activeWorkspace: WorkspaceInfo | null;
  onDebug?: (entry: DebugEntry) => void;
  preferredModelId?: string | null;
  preferredEffort?: string | null;
  preferredSelectionReady?: boolean;
};

type UseModelsResult = {
  models: ModelOption[];
  modelsReady: boolean;
  selectedModel: ModelOption | null;
  reasoningSupported: boolean;
  selectedModelId: string | null;
  setSelectedModelId: (next: string | null) => void;
  reasoningOptions: string[];
  selectedEffort: string | null;
  setSelectedEffort: (next: string | null) => void;
  refreshModels: () => Promise<void>;
  globalSelectionReady: boolean;
};

type ModelRefreshPhase = "active-workspace" | "idle-prewarm" | "on-demand";

const CONFIG_MODEL_DESCRIPTION = "Configured in CODEX_HOME/config.toml";

const createModelOption = (
  id: string,
  displayName: string,
  description = "",
  source = "unknown",
  supportedReasoningEfforts: ModelOption["supportedReasoningEfforts"] = [],
  defaultReasoningEffort: string | null = null,
): ModelOption => ({
  id,
  model: id,
  displayName,
  description,
  source,
  supportedReasoningEfforts,
  defaultReasoningEffort,
  isDefault: false,
});

const normalizeModelIdentity = (model: ModelOption): string => {
  const modelId = model.model.trim().toLowerCase();
  if (modelId.length > 0) {
    return modelId;
  }
  return model.id.trim().toLowerCase();
};

const mergeReasoningMetadata = (
  existingModel: ModelOption,
  overridingModel: ModelOption,
) => ({
  supportedReasoningEfforts:
    overridingModel.supportedReasoningEfforts.length > 0
      ? overridingModel.supportedReasoningEfforts
      : existingModel.supportedReasoningEfforts,
  defaultReasoningEffort:
    overridingModel.defaultReasoningEffort ?? existingModel.defaultReasoningEffort,
});

const mergeModelOption = (existing: ModelOption, next: ModelOption): ModelOption => ({
  ...existing,
  id: next.id || existing.id,
  model: next.model || existing.model,
  displayName: next.displayName || existing.displayName,
  description: next.description || existing.description,
  source: next.source || existing.source,
  provider: next.provider ?? existing.provider,
  protocol: next.protocol ?? existing.protocol,
  provenance: next.provenance ?? existing.provenance,
  observedAt: next.observedAt ?? existing.observedAt,
  lastVerifiedAt: next.lastVerifiedAt ?? existing.lastVerifiedAt,
  lifecycle: next.lifecycle ?? existing.lifecycle,
  ...mergeReasoningMetadata(existing, next),
});

const upsertModelOption = (
  mergedModels: ModelOption[],
  seenIdentities: Map<string, number>,
  model: ModelOption,
  replaceExisting = false,
) => {
  const identity = normalizeModelIdentity(model);
  if (identity.length === 0) {
    return;
  }
  const existingIndex = seenIdentities.get(identity);
  if (existingIndex === undefined) {
    seenIdentities.set(identity, mergedModels.length);
    mergedModels.push(model);
    return;
  }
  if (replaceExisting) {
    mergedModels[existingIndex] = mergeModelOption(mergedModels[existingIndex], model);
  }
};

const readCustomCodexModelOptions = (): ModelOption[] => {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }
  try {
    const stored = window.localStorage.getItem(PROVIDER_STORAGE_KEYS.CODEX_CUSTOM_MODELS);
    if (!stored) {
      return [];
    }
    return validateCodexCustomModels(JSON.parse(stored)).map((model) =>
      // 用户管理自定义模型：无 runtime capability 来源，统一暴露主流默认档
      // （enrichScopedCodexReasoningMetadata 的 authoritative 匹配仍优先覆盖）。
      createModelOption(
        model.id,
        model.label,
        model.description ?? "",
        "custom",
        CUSTOM_MODEL_SUPPORTED_REASONING_OPTIONS,
        CUSTOM_MODEL_DEFAULT_REASONING_EFFORT,
      ),
    );
  } catch {
    return [];
  }
};

const getBuiltInCodexModelOptions = (): ModelOption[] =>
  CODEX_MODEL_CATALOG.map((model) => ({
    ...createModelOption(
      model.id,
      model.label,
      model.description,
      "catalog",
      model.supportedReasoningEfforts ?? [],
      normalizeEffort(model.defaultReasoningEffort),
    ),
    provider: model.provider,
    protocol: model.protocol,
    provenance: model.provenance,
    lastVerifiedAt: model.lastVerifiedAt,
    lifecycle: model.lifecycle,
  }));

const mergeCodexSelectableModels = (baseModels: ModelOption[]): ModelOption[] => {
  const mergedModels: ModelOption[] = [];
  const seenIdentities = new Map<string, number>();
  const builtInModels = getBuiltInCodexModelOptions();
  const customModels = readCustomCodexModelOptions();

  builtInModels.forEach((model) =>
    upsertModelOption(mergedModels, seenIdentities, model),
  );
  customModels.forEach((model) =>
    upsertModelOption(mergedModels, seenIdentities, model, true),
  );
  baseModels.forEach((model) =>
    upsertModelOption(mergedModels, seenIdentities, model, true),
  );

  const mergedByIdentity = new Map(
    mergedModels.map((model) => [normalizeModelIdentity(model), model]),
  );
  const toCatalogEntries = (
    entries: readonly ModelOption[],
    source: ModelCatalogEntry["source"],
  ): ModelCatalogEntry[] =>
    entries.map((model) => ({
      engine: "codex",
      provider: "openai",
      protocol: "openai-responses",
      id: normalizeModelIdentity(model),
      label: model.displayName,
      description: model.description,
      source,
      provenance: `codex:${model.source || source}`,
      supportedReasoningEfforts: model.supportedReasoningEfforts,
      defaultReasoningEffort: model.defaultReasoningEffort,
    }));
  const catalog = mergeModelCatalogSources([
    toCatalogEntries(baseModels, "runtime"),
    toCatalogEntries(customModels, "configured"),
    CODEX_MODEL_FALLBACK_ENTRIES,
  ]);
  return catalog.flatMap((entry) => {
    const mergedModel = mergedByIdentity.get(entry.id);
    return mergedModel ? [mergedModel] : [];
  });
};

const normalizeEffort = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeReasoningEfforts = (
  value: unknown,
): ModelOption["supportedReasoningEfforts"] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((effort) => {
    if (typeof effort === "string") {
      const reasoningEffort = normalizeEffort(effort);
      return reasoningEffort ? [{ reasoningEffort, description: "" }] : [];
    }
    if (!effort || typeof effort !== "object") {
      return [];
    }
    const record = effort as Record<string, unknown>;
    const reasoningEffort = normalizeEffort(
      record.reasoningEffort ?? record.reasoning_effort,
    );
    if (!reasoningEffort) {
      return [];
    }
    return [
      {
        reasoningEffort,
        description: String(record.description ?? ""),
      },
    ];
  });
};

const findModelByIdOrModel = (
  models: ModelOption[],
  idOrModel: string | null,
): ModelOption | null => {
  if (!idOrModel) {
    return null;
  }
  return (
    models.find((model) => model.id === idOrModel) ??
    models.find((model) => model.model === idOrModel) ??
    null
  );
};

const pickDefaultModel = (models: ModelOption[], configModel: string | null) =>
  findModelByIdOrModel(models, configModel) ??
  models.find((model) => model.isDefault) ??
  models[0] ??
  null;

/**
 * 纯函数：统一 model effort 解析语义（唯一事实源）。
 * 优先级：用户当前选择 → preferred → model default。
 * supported 为空时仍允许 preferred / default，避免与 UI backfill 语义分裂。
 */
export const resolveModelEffort = (
  model: ModelOption,
  options: {
    preferCurrent: boolean;
    currentEffort: string | null;
    preferredEffort: string | null;
  },
): string | null => {
  const supportedEfforts = model.supportedReasoningEfforts.map(
    (effort) => effort.reasoningEffort,
  );
  const currentEffort = normalizeEffort(options.currentEffort);
  if (options.preferCurrent && currentEffort) {
    return currentEffort;
  }
  const preferred = normalizeEffort(options.preferredEffort);
  const modelDefault = normalizeEffort(model.defaultReasoningEffort);
  if (supportedEfforts.length === 0) {
    return preferred ?? modelDefault;
  }
  if (preferred && supportedEfforts.includes(preferred)) {
    return preferred;
  }
  return modelDefault;
};

type ComposerSelectionPlan = {
  nextModelId: string | null;
  nextEffort: string | null;
  clearUserSelectedModel: boolean;
};

/**
 * 纯函数：从 catalog + preferred + 用户意图计算下一次应提交的 selection。
 * layout / refresh 共用，保证只有一套收敛规则。
 */
export const planComposerModelSelection = (input: {
  models: ModelOption[];
  configModel: string | null;
  preferredModelId: string | null;
  preferredEffort: string | null;
  preferredSelectionReady: boolean;
  selectedModelId: string | null;
  selectedEffort: string | null;
  hasUserSelectedModel: boolean;
  hasUserSelectedEffort: boolean;
}): ComposerSelectionPlan | null => {
  const {
    models,
    configModel,
    preferredModelId,
    preferredEffort,
    preferredSelectionReady,
    selectedModelId,
    selectedEffort,
    hasUserSelectedModel,
    hasUserSelectedEffort,
  } = input;

  if (models.length === 0) {
    return null;
  }
  if (!preferredSelectionReady && !hasUserSelectedModel) {
    return null;
  }

  const existingSelection = findModelByIdOrModel(models, selectedModelId);
  let clearUserSelectedModel = false;
  let keepUserModel = hasUserSelectedModel;
  if (selectedModelId && !existingSelection) {
    clearUserSelectedModel = true;
    keepUserModel = false;
  }

  const preferredSelection = findModelByIdOrModel(models, preferredModelId);
  const defaultModel = pickDefaultModel(models, configModel);
  const nextModel =
    (keepUserModel && existingSelection ? existingSelection : null) ??
    preferredSelection ??
    defaultModel ??
    existingSelection ??
    null;
  if (!nextModel) {
    return null;
  }

  // effort 锁定策略（兼容旧行为，避免业务漂移）：
  // 1) 用户显式选过 effort → 始终 preferCurrent
  // 2) 用户锁住 model 且已有非空 effort → 不随 preferred 漂移（旧 layout early-return）
  // 3) effort 仍为空 → 走 preferred/default 单源解析（替代旧 backfill effect）
  const currentEffort = normalizeEffort(selectedEffort);
  const preferCurrentEffort =
    hasUserSelectedEffort || (keepUserModel && currentEffort !== null);

  return {
    nextModelId: nextModel.id,
    nextEffort: resolveModelEffort(nextModel, {
      preferCurrent: preferCurrentEffort,
      currentEffort: selectedEffort,
      preferredEffort,
    }),
    clearUserSelectedModel,
  };
};

export function useModels({
  activeWorkspace,
  onDebug,
  preferredModelId = null,
  preferredEffort = null,
  preferredSelectionReady = true,
}: UseModelsOptions): UseModelsResult {
  const [rawModels, setRawModels] = useState<ModelOption[]>([]);
  const [configModel, setConfigModel] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelIdState] = useState<string | null>(null);
  const [selectedEffort, setSelectedEffortState] = useState<string | null>(null);
  const [modelMappingVersion, setModelMappingVersion] = useState(0);
  const lastCatalogAttemptWorkspaceId = useRef<string | null>(null);
  const inFlightWorkspaceId = useRef<string | null>(null);
  const latestRefreshRequestId = useRef(0);
  const hasUserSelectedModel = useRef(false);
  const hasUserSelectedEffort = useRef(false);
  const lastWorkspaceId = useRef<string | null>(null);
  const [catalogReadyForWorkspace, setCatalogReadyForWorkspace] = useState(false);
  const catalogCacheByWorkspace = useRef(
    new Map<string, ReturnType<typeof createModelCatalogCache>>(),
  );
  // 供 async refresh 读取最新 selection，避免把 state 塞进 refresh deps 形成反馈环
  const selectionSnapshotRef = useRef({
    selectedModelId: null as string | null,
    selectedEffort: null as string | null,
    preferredModelId,
    preferredEffort,
    preferredSelectionReady,
  });
  selectionSnapshotRef.current = {
    selectedModelId,
    selectedEffort,
    preferredModelId,
    preferredEffort,
    preferredSelectionReady,
  };

  const workspaceId = activeWorkspace?.id ?? null;
  const isConnected = Boolean(activeWorkspace?.connected);
  const activeWorkspaceIdRef = useRef<string | null>(workspaceId);
  activeWorkspaceIdRef.current = workspaceId;
  // Codex catalog only — never apply Claude ANTHROPIC_* mapping here.
  // modelCatalogVersion bumps when custom Codex models change in localStorage.
  const models = useMemo(() => {
    void modelMappingVersion;
    return mergeCodexSelectableModels(rawModels);
  }, [rawModels, modelMappingVersion]);

  // 幂等写入：语义相等则保持同一 reference，切断 setState → layout → setState 环
  const commitSelectedModelId = useCallback((next: string | null) => {
    setSelectedModelIdState((prev) => (prev === next ? prev : next));
  }, []);

  const commitSelectedEffort = useCallback((next: string | null) => {
    const normalized = normalizeEffort(next);
    setSelectedEffortState((prev) =>
      normalizeEffort(prev) === normalized ? prev : normalized,
    );
  }, []);

  const applySelectionPlan = useCallback(
    (plan: ComposerSelectionPlan) => {
      if (plan.clearUserSelectedModel) {
        hasUserSelectedModel.current = false;
      }
      commitSelectedModelId(plan.nextModelId);
      commitSelectedEffort(plan.nextEffort);
    },
    [commitSelectedEffort, commitSelectedModelId],
  );

  // Listen for localStorage changes (cross-tab sync + custom events)
  useEffect(() => {
    const isRelevantStorageKey = (key: string | null | undefined) =>
      key === PROVIDER_STORAGE_KEYS.CODEX_CUSTOM_MODELS;

    const handleStorageChange = (e: StorageEvent) => {
      if (isRelevantStorageKey(e.key)) {
        setModelMappingVersion((v) => v + 1);
      }
    };

    const handleCustomStorageChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ key: string }>;
      if (isRelevantStorageKey(customEvent.detail?.key)) {
        setModelMappingVersion((v) => v + 1);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("localStorageChange", handleCustomStorageChange);

    // Initial read of custom Codex models in case they were set before we started listening
    if (readCustomCodexModelOptions().length > 0) {
      setModelMappingVersion((v) => v + 1);
    }

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("localStorageChange", handleCustomStorageChange);
    };
  }, []);

  useLayoutEffect(() => {
    if (workspaceId === lastWorkspaceId.current) {
      return;
    }
    hasUserSelectedModel.current = false;
    hasUserSelectedEffort.current = false;
    lastWorkspaceId.current = workspaceId;
    lastCatalogAttemptWorkspaceId.current = null;
    setConfigModel(null);
    setRawModels([]);
    setSelectedModelIdState(null);
    setSelectedEffortState(null);
    setCatalogReadyForWorkspace(false);
  }, [workspaceId]);

  const setSelectedModelId = useCallback(
    (next: string | null) => {
      hasUserSelectedModel.current = true;
      commitSelectedModelId(next);
    },
    [commitSelectedModelId],
  );

  const setSelectedEffort = useCallback(
    (next: string | null) => {
      hasUserSelectedEffort.current = true;
      commitSelectedEffort(next);
    },
    [commitSelectedEffort],
  );

  const selectedModel = useMemo(
    () => models.find((model) => model.id === selectedModelId) ?? null,
    [models, selectedModelId],
  );

  const reasoningSupported = useMemo(() => {
    if (!selectedModel) {
      return false;
    }
    return (
      selectedModel.supportedReasoningEfforts.length > 0 ||
      selectedModel.defaultReasoningEffort !== null
    );
  }, [selectedModel]);

  const reasoningOptions = useMemo(() => {
    const supported = selectedModel?.supportedReasoningEfforts.map(
      (effort) => effort.reasoningEffort,
    );
    if (supported && supported.length > 0) {
      return supported;
    }
    const defaultEffort = normalizeEffort(selectedModel?.defaultReasoningEffort);
    return defaultEffort ? [defaultEffort] : [];
  }, [selectedModel]);

  const refreshModels = useCallback(async (phase: ModelRefreshPhase = "on-demand") => {
    if (!workspaceId || !isConnected) {
      return;
    }
    if (inFlightWorkspaceId.current === workspaceId) {
      return;
    }
    inFlightWorkspaceId.current = workspaceId;
    const refreshRequestId = latestRefreshRequestId.current + 1;
    latestRefreshRequestId.current = refreshRequestId;
    const requestedWorkspaceId = workspaceId;
    onDebug?.({
      id: `${Date.now()}-client-model-list`,
      timestamp: Date.now(),
      source: "client",
      label: "model/list",
      payload: { workspaceId },
    });
    try {
      type ModelCatalogResult = [
        PromiseSettledResult<Awaited<ReturnType<typeof getModelList>> | null>,
        PromiseSettledResult<Awaited<ReturnType<typeof getConfigModel>>>,
      ];
      const [modelListResult, configModelResult] =
        await startupOrchestrator.run<ModelCatalogResult>({
          id: `model-catalog:${workspaceId}`,
          phase,
          priority: phase === "on-demand" ? 85 : 35,
          dedupeKey: `model-catalog:${workspaceId}`,
          concurrencyKey: "model-catalog",
          timeoutMs: 8_000,
          workspaceScope: { workspaceId },
          cancelPolicy: "soft-ignore",
          traceLabel: "model/list",
          commandLabel: "model_list",
          run: () =>
            Promise.allSettled([
              getModelList(workspaceId),
              getConfigModel(workspaceId),
            ]),
          fallback: () =>
            [
              { status: "fulfilled", value: null },
              { status: "fulfilled", value: null },
            ] satisfies ModelCatalogResult,
        });
      const configModelFromConfig =
        configModelResult.status === "fulfilled"
          ? configModelResult.value
          : null;
      if (configModelResult.status === "rejected") {
        onDebug?.({
          id: `${Date.now()}-client-config-model-error`,
          timestamp: Date.now(),
          source: "error",
          label: "config/model error",
          payload:
            configModelResult.reason instanceof Error
              ? configModelResult.reason.message
              : String(configModelResult.reason),
        });
      }
      const response =
        modelListResult.status === "fulfilled" ? modelListResult.value : null;
      if (modelListResult.status === "rejected") {
        onDebug?.({
          id: `${Date.now()}-client-model-list-error`,
          timestamp: Date.now(),
          source: "error",
          label: "model/list error",
          payload:
            modelListResult.reason instanceof Error
              ? modelListResult.reason.message
              : String(modelListResult.reason),
        });
      }
      onDebug?.({
        id: `${Date.now()}-server-model-list`,
        timestamp: Date.now(),
        source: "server",
        label: "model/list response",
        payload: response,
      });
      const isStaleResponse =
        latestRefreshRequestId.current !== refreshRequestId ||
        activeWorkspaceIdRef.current !== requestedWorkspaceId;
      if (isStaleResponse) {
        return;
      }
      setConfigModel(configModelFromConfig);
      const rawData = response?.result?.data ?? response?.data ?? [];
      const dataFromServer: ModelOption[] = rawData.map((item: any) => ({
        id: String(item.id ?? item.model ?? ""),
        model: String(item.model ?? item.id ?? ""),
        displayName: String(item.displayName ?? item.display_name ?? item.model ?? ""),
        description: String(item.description ?? ""),
        source: String(item.source ?? "unknown"),
        provider:
          typeof item.provider === "string" ? item.provider : null,
        protocol:
          typeof item.protocol === "string" ? item.protocol : null,
        provenance:
          typeof item.provenance === "string" ? item.provenance : null,
        observedAt:
          typeof item.observedAt === "number"
            ? item.observedAt
            : typeof item.observed_at === "number"
              ? item.observed_at
              : null,
        lastVerifiedAt:
          typeof item.lastVerifiedAt === "string"
            ? item.lastVerifiedAt
            : typeof item.last_verified_at === "string"
              ? item.last_verified_at
              : null,
        lifecycle:
          typeof item.lifecycle === "string" ? item.lifecycle : null,
        supportedReasoningEfforts: normalizeReasoningEfforts(
          item.supportedReasoningEfforts ?? item.supported_reasoning_efforts,
        ),
        defaultReasoningEffort: normalizeEffort(
          item.defaultReasoningEffort ?? item.default_reasoning_effort,
        ),
        isDefault: Boolean(item.isDefault ?? item.is_default ?? false),
      }));
      let effectiveDataFromServer = dataFromServer;
      let catalogCache = catalogCacheByWorkspace.current.get(requestedWorkspaceId);
      if (!catalogCache) {
        catalogCache = createModelCatalogCache();
        catalogCacheByWorkspace.current.set(requestedWorkspaceId, catalogCache);
      }
      if (dataFromServer.length > 0) {
        catalogCache.commit(
          dataFromServer.map((model) => ({
            engine: "codex",
            provider: "openai",
            protocol: "openai-responses",
            id: normalizeModelIdentity(model),
            label: model.displayName,
            description: model.description,
            source: "runtime",
            provenance: `codex:${model.source}`,
            observedAt: Date.now(),
            supportedReasoningEfforts: model.supportedReasoningEfforts,
            defaultReasoningEffort: model.defaultReasoningEffort,
          })),
        );
      } else if (modelListResult.status === "rejected" || response === null) {
        const staleCatalog = catalogCache.fail(
          modelListResult.status === "rejected"
            ? modelListResult.reason
            : new Error("model/list unavailable"),
        );
        effectiveDataFromServer = staleCatalog.entries.map((entry) => ({
          ...createModelOption(
            entry.id,
            entry.label,
            entry.description,
            "cache:stale",
            [...(entry.supportedReasoningEfforts ?? [])],
            entry.defaultReasoningEffort ?? null,
          ),
          provider: entry.provider,
          protocol: entry.protocol,
          provenance: entry.provenance,
          observedAt: entry.observedAt ?? null,
          lastVerifiedAt: entry.lastVerifiedAt ?? null,
          lifecycle: entry.lifecycle ?? null,
        }));
        onDebug?.({
          id: `${Date.now()}-client-model-catalog-stale`,
          timestamp: Date.now(),
          source: "error",
          label: "model catalog stale",
          payload: {
            workspaceId: requestedWorkspaceId,
            error: staleCatalog.error,
            entryCount: staleCatalog.entries.length,
          },
        });
      }
      const data = (() => {
        if (!configModelFromConfig) {
          return effectiveDataFromServer;
        }
        const hasConfigModel = effectiveDataFromServer.some(
          (model) => model.model === configModelFromConfig,
        );
        if (hasConfigModel) {
          return effectiveDataFromServer;
        }
        const configOption: ModelOption = {
          id: configModelFromConfig,
          model: configModelFromConfig,
          displayName: `${configModelFromConfig} (config)`,
          description: CONFIG_MODEL_DESCRIPTION,
          source: "settings-override",
          supportedReasoningEfforts: [],
          defaultReasoningEffort: null,
          isDefault: false,
        };
        return [configOption, ...effectiveDataFromServer];
      })();
      const selectableData = mergeCodexSelectableModels(data);
      setRawModels(data);
      lastCatalogAttemptWorkspaceId.current = requestedWorkspaceId;
      setCatalogReadyForWorkspace(
        modelListResult.status === "fulfilled" && Array.isArray(rawData),
      );
      const snapshot = selectionSnapshotRef.current;
      const plan = planComposerModelSelection({
        models: selectableData,
        configModel: configModelFromConfig,
        preferredModelId: snapshot.preferredModelId,
        preferredEffort: snapshot.preferredEffort,
        preferredSelectionReady: snapshot.preferredSelectionReady,
        selectedModelId: snapshot.selectedModelId,
        selectedEffort: snapshot.selectedEffort,
        hasUserSelectedModel: hasUserSelectedModel.current,
        hasUserSelectedEffort: hasUserSelectedEffort.current,
      });
      if (plan) {
        applySelectionPlan(plan);
      }
    } finally {
      if (inFlightWorkspaceId.current === requestedWorkspaceId) {
        inFlightWorkspaceId.current = null;
      }
    }
  }, [applySelectionPlan, isConnected, onDebug, workspaceId]);

  useEffect(() => {
    if (!workspaceId || !isConnected) {
      return;
    }
    if (lastCatalogAttemptWorkspaceId.current === workspaceId) {
      return;
    }
    refreshModels("active-workspace");
  }, [isConnected, refreshModels, workspaceId]);

  // 唯一同步收敛入口：catalog / preferred 变化时规划并幂等提交。
  // 不再另设 effort backfill effect，避免双写对打（React #185）。
  // selection 经 snapshot ref 读取，不把 selected* 放进 deps——切断「commit → layout 再 commit」自反馈
  // （B1）；用户 setSelected* 已直接写入，无需 layout 回声。
  useLayoutEffect(() => {
    const snapshot = selectionSnapshotRef.current;
    const plan = planComposerModelSelection({
      models,
      configModel,
      preferredModelId,
      preferredEffort,
      preferredSelectionReady,
      selectedModelId: snapshot.selectedModelId,
      selectedEffort: snapshot.selectedEffort,
      hasUserSelectedModel: hasUserSelectedModel.current,
      hasUserSelectedEffort: hasUserSelectedEffort.current,
    });
    if (!plan) {
      return;
    }
    applySelectionPlan(plan);
  }, [
    applySelectionPlan,
    configModel,
    models,
    preferredEffort,
    preferredModelId,
    preferredSelectionReady,
  ]);

  return {
    models,
    modelsReady: catalogReadyForWorkspace,
    selectedModel,
    reasoningSupported,
    selectedModelId,
    setSelectedModelId,
    reasoningOptions,
    selectedEffort,
    setSelectedEffort,
    refreshModels,
    globalSelectionReady: preferredSelectionReady && catalogReadyForWorkspace,
  };
}
