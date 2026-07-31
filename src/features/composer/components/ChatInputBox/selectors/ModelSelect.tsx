import { Fragment, memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CheckIcon from 'lucide-react/dist/esm/icons/check';
import Settings2Icon from 'lucide-react/dist/esm/icons/settings-2';
import type { ModelInfo, ProviderId } from '../types';
import type { ProviderModelGroup } from '../modelOptions';
import type { ProviderTargetGroup } from '../hooks/useProviderTargetCatalogOwners';
import type { ExecutionTarget } from '../../../../shared-session/target/types';
import {
  CLAUDE_LOCAL_PROVIDER_PROFILE_ID,
  CODEX_DISK_PROVIDER_PROFILE_ID,
  GROK_LOCAL_PROVIDER_PROFILE_ID,
  KIMI_LOCAL_PROVIDER_PROFILE_ID,
  OPENCODE_LOCAL_PROVIDER_PROFILE_ID,
} from '../../../../threads/constants/codexProviderProfiles';
import { EngineIcon } from '../../../../engine/components/EngineIcon';
import { ProviderBrandIconImg } from '../../../../vendors/components/ProviderBrandIconImg';
import { resolveProviderBrandIcon } from '../../../../vendors/providerBrandIcon';
import {
  STORAGE_KEYS as MODEL_MAPPING_STORAGE_KEYS,
  getModelMapping,
  resolveModelMappingValue,
  type ModelMapping,
} from '../../../../models/constants';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';

interface ModelSelectProps {
  value: string;
  onChange: (modelId: string) => void;
  models?: ModelInfo[];  // Optional dynamic model list
  currentProvider?: string;  // Current provider type
  providerLabel?: string;
  triggerVariant?: 'default' | 'readiness';
  modelGroups?: ProviderModelGroup[];
  onProviderModelChange?: (providerId: ProviderId, modelId: string) => void;
  onAddModel?: () => void;  // Navigate to model management
  onRefreshConfig?: () => Promise<void> | void; // Refresh current provider config
  isRefreshingConfig?: boolean;
  /** Jump to CLI / provider settings management page */
  onOpenCliSettings?: () => void;
  // 共享会话(atomic)目标选择:与 legacy 相同的「引擎子菜单 → 平铺模型」
  // 交互,数据来自 target catalog,选中产出完整 ExecutionTarget。
  targetGroups?: ProviderTargetGroup[];
  executionTarget?: ExecutionTarget | null;
  onExecutionTargetChange?: (target: ExecutionTarget) => void;
  onOpenTargetCatalog?: () => Promise<void> | void;
  onOpenProviderProfile?: (
    providerId: ProviderId,
    providerProfileId: string,
  ) => Promise<void> | void;
  targetCatalogError?: string | null;
  onReloadProviderConfig?: (
    providerId: ProviderId,
    providerProfileId: string,
  ) => Promise<void> | void;
}

const MODEL_LABEL_KEYS: Record<string, string> = {
  'claude-fable-5': 'models.claude.fable5.label',
  'claude-opus-5': 'models.claude.opus5.label',
  'claude-opus-4-8': 'models.claude.opus48.label',
  'claude-sonnet-5': 'models.claude.sonnet5.label',
  'claude-sonnet-4-7': 'models.claude.sonnet47.label',
  'claude-sonnet-4-6': 'models.claude.sonnet46.label',
  'claude-haiku-4-5': 'models.claude.haiku45.label',
  'claude-haiku-4-5-20251001': 'models.claude.haiku45.label',
  'gpt-5.6-sol': 'models.codex.gpt56sol.label',
  'gpt-5.6-terra': 'models.codex.gpt56terra.label',
  'gpt-5.6-luna': 'models.codex.gpt56luna.label',
  'gpt-5.5': 'models.codex.gpt55.label',
};

const MODEL_DESCRIPTION_KEYS: Record<string, string> = {
  'claude-fable-5': 'models.claude.fable5.description',
  'claude-opus-5': 'models.claude.opus5.description',
  'claude-opus-4-8': 'models.claude.opus48.description',
  'claude-sonnet-5': 'models.claude.sonnet5.description',
  'claude-sonnet-4-7': 'models.claude.sonnet47.description',
  'claude-sonnet-4-6': 'models.claude.sonnet46.description',
  'claude-haiku-4-5': 'models.claude.haiku45.description',
  'claude-haiku-4-5-20251001': 'models.claude.haiku45.description',
  'gpt-5.6-sol': 'models.codex.gpt56sol.description',
  'gpt-5.6-terra': 'models.codex.gpt56terra.description',
  'gpt-5.6-luna': 'models.codex.gpt56luna.description',
  'gpt-5.5': 'models.codex.gpt55.description',
};

const LOCAL_PROVIDER_PROFILE_IDS: Partial<Record<ProviderId, string>> = {
  claude: CLAUDE_LOCAL_PROVIDER_PROFILE_ID,
  codex: CODEX_DISK_PROVIDER_PROFILE_ID,
  kimi: KIMI_LOCAL_PROVIDER_PROFILE_ID,
  grok: GROK_LOCAL_PROVIDER_PROFILE_ID,
  opencode: OPENCODE_LOCAL_PROVIDER_PROFILE_ID,
};

export function normalizeExecutionProviderProfileId(
  providerId: ProviderId,
  providerProfileId: string | null | undefined,
): string | null {
  const normalizedProviderProfileId = providerProfileId?.trim();
  return !normalizedProviderProfileId ||
    LOCAL_PROVIDER_PROFILE_IDS[providerId] === normalizedProviderProfileId
    ? null
    : normalizedProviderProfileId;
}

/**
 * 每个 CLI 只投影一个活跃渠道:当前 CLI 取 executionTarget 所选渠道
 * (空 = 本地默认),其余 CLI 一律取本地默认渠道。
 */
export function resolveActiveProviderProfileId(
  providerId: ProviderId,
  executionTarget: Pick<
    ExecutionTarget,
    'engine' | 'providerProfileId'
  > | null | undefined,
): string | null {
  const targetProfileId =
    executionTarget?.engine === providerId
      ? normalizeExecutionProviderProfileId(
          providerId,
          executionTarget.providerProfileId,
        )
      : null;
  return targetProfileId ?? LOCAL_PROVIDER_PROFILE_IDS[providerId] ?? null;
}

export function isSameProviderExecutionProfile(
  currentProvider: ProviderId,
  currentProviderProfileId: string | null | undefined,
  target: Pick<ExecutionTarget, 'engine' | 'providerProfileId'>,
): boolean {
  return (
    target.engine === currentProvider &&
    normalizeExecutionProviderProfileId(
      currentProvider,
      target.providerProfileId,
    ) ===
      normalizeExecutionProviderProfileId(
        currentProvider,
        currentProviderProfileId,
      )
  );
}

export function buildProviderExecutionTarget(
  current: ExecutionTarget | null | undefined,
  providerId: ProviderId,
  providerProfileId: string,
  modelCatalogEntryId: string,
  providerProfileNameSnapshot?: string,
  providerProfileSource?: 'disk' | 'managed',
  normalizeProviderProfile = true,
  runtimeModel?: string,
): ExecutionTarget {
  const normalizedProviderProfileId = normalizeProviderProfile
    ? normalizeExecutionProviderProfileId(providerId, providerProfileId)
    : providerProfileId;
  const normalizedRuntimeModel = runtimeModel?.trim() || null;
  return {
    engine: providerId,
    providerProfileId: normalizedProviderProfileId,
    modelCatalogEntryId,
    model: normalizedRuntimeModel,
    providerProfileNameSnapshot:
      providerProfileNameSnapshot?.trim() || null,
    providerProfileSource: providerProfileSource ?? null,
    reasoning:
      current?.engine === providerId &&
      current.providerProfileId === normalizedProviderProfileId
        ? current.reasoning ?? null
        : null,
  };
}

function resolveRuntimeModel(model: ModelInfo): string | undefined {
  return model.model?.trim() || model.id.trim() || undefined;
}

/**
 * Resolve the model id used for brand-icon matching.
 * Prefer the mapped runtime model (e.g. kimi-k3) so third-party providers show
 * their own logo instead of the Claude glyph.
 */
function resolveModelIdForIcon(
  model: ModelInfo | null | undefined,
  mapping: ModelMapping,
): string | null {
  if (!model) {
    return null;
  }
  const mapped = resolveModelMappingValue(model.id, mapping);
  if (mapped) {
    return mapped;
  }
  return resolveRuntimeModel(model) ?? model.id;
}

function isSelectedExecutionModel(
  executionTarget: ExecutionTarget | null | undefined,
  model: ModelInfo,
): boolean {
  const selectedCatalogEntryId = executionTarget?.modelCatalogEntryId?.trim();
  if (selectedCatalogEntryId) {
    return selectedCatalogEntryId === model.id;
  }
  const selectedRuntimeModel = executionTarget?.model?.trim();
  return Boolean(
    selectedRuntimeModel &&
      selectedRuntimeModel === resolveRuntimeModel(model),
  );
}

/**
 * 分组子菜单的统一投影:legacy(modelGroups)与 atomic(targetGroups)
 * 共用同一套「引擎子菜单 → 平铺模型」渲染,差异只在选择/刷新行为。
 */
type PickerModelGroup = {
  providerId: ProviderId;
  providerLabel: string;
  models: ModelInfo[];
  enabled: boolean;
  disabledReason?: string;
  loading: boolean;
  reloading: boolean;
  error: string | null;
  targetProfileId: string | null;
  targetProfileLabel?: string;
  targetProfileSource?: 'disk' | 'managed';
};

/**
 * Model icon component - displays vendor icons for mapped runtime models and
 * falls back to the owning CLI icon.
 */
const ModelIcon = ({
  provider,
  model,
  modelIdForIcon,
  size = 16,
}: {
  provider?: string;
  model?: ModelInfo | null;
  /** Pre-resolved id for brand matching (mapped runtime name preferred). */
  modelIdForIcon?: string | null;
  size?: number;
}) => {
  const imgStyle = { width: size, height: size, flexShrink: 0 } as const;
  const resolvedModelId =
    modelIdForIcon?.trim() ||
    (model ? resolveRuntimeModel(model) ?? model.id : null);
  const brandIconSrc = resolvedModelId
    ? resolveProviderBrandIcon({
        modelId: resolvedModelId,
        presetId: provider,
      })
    : null;
  if (brandIconSrc) {
    return (
      <span style={imgStyle} className="selector-model-brand-icon" aria-hidden>
        <ProviderBrandIconImg src={brandIconSrc} />
      </span>
    );
  }
  switch (provider) {
    case 'codex':
      return <EngineIcon engine="codex" size={size} style={imgStyle} />;
    case 'gemini':
      return <EngineIcon engine="gemini" size={size} style={imgStyle} />;
    case 'grok':
      return <EngineIcon engine="grok" size={size} style={imgStyle} />;
    case 'kimi':
      return <EngineIcon engine="kimi" size={size} style={imgStyle} />;
    case 'opencode':
      return <EngineIcon engine="opencode" size={size} style={imgStyle} />;
    case 'claude':
    default:
      return <EngineIcon engine="claude" size={size} style={imgStyle} />;
  }
};

/**
 * ModelSelect - Model selector component
 * Supports switching between Sonnet 4.5, Opus 4.5, and other models, including Codex models
 */
export const ModelSelect = memo(({
  value,
  onChange,
  models = [],
  currentProvider = 'claude',
  triggerVariant = 'default',
  modelGroups,
  onProviderModelChange,
  onAddModel,
  onRefreshConfig,
  isRefreshingConfig = false,
  onOpenCliSettings,
  targetGroups,
  executionTarget,
  onExecutionTargetChange,
  onOpenTargetCatalog,
  onOpenProviderProfile,
  targetCatalogError,
  onReloadProviderConfig,
}: ModelSelectProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [refreshConfigError, setRefreshConfigError] = useState<string | null>(null);
  const [modelMappingVersion, setModelMappingVersion] = useState(0);

  // Keep label/icon mapping in sync when the active provider rewrites
  // claude-model-mapping (same-tab custom event + cross-tab storage).
  useEffect(() => {
    const isRelevant = (key: string | null | undefined) =>
      key === MODEL_MAPPING_STORAGE_KEYS.CLAUDE_MODEL_MAPPING;
    const onStorage = (event: StorageEvent) => {
      if (isRelevant(event.key)) {
        setModelMappingVersion((version) => version + 1);
      }
    };
    const onCustom = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string }>).detail;
      if (isRelevant(detail?.key)) {
        setModelMappingVersion((version) => version + 1);
      }
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('localStorageChange', onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('localStorageChange', onCustom);
    };
  }, []);

  const modelMapping = useMemo(() => {
    void modelMappingVersion;
    return getModelMapping();
  }, [modelMappingVersion]);

  const hasTargetGroups = Boolean(targetGroups && targetGroups.length > 0);

  const pickerGroups = useMemo<PickerModelGroup[]>(() => {
    if (targetGroups && targetGroups.length > 0) {
      return targetGroups.map((group) => {
        const activeProfileId = resolveActiveProviderProfileId(
          group.providerId,
          executionTarget,
        );
        const activeProfile =
          group.profiles.find((profile) => profile.id === activeProfileId) ??
          group.profiles.find((profile) => profile.enabled !== false) ??
          group.profiles[0];
        return {
          providerId: group.providerId,
          providerLabel: group.providerLabel,
          models: activeProfile?.models ?? [],
          enabled: group.enabled && Boolean(activeProfile),
          disabledReason: group.disabledReason,
          loading: activeProfile?.loading ?? false,
          reloading:
            activeProfile?.reloadingConfig ?? activeProfile?.loading ?? false,
          error: activeProfile?.error ?? null,
          targetProfileId: activeProfile?.id ?? null,
          targetProfileLabel: activeProfile?.label,
          targetProfileSource: activeProfile?.source,
        };
      });
    }
    return (modelGroups ?? []).map((group) => ({
      providerId: group.providerId,
      providerLabel: group.providerLabel,
      models: group.models,
      enabled: true,
      loading: false,
      reloading: false,
      error: null,
      targetProfileId: null,
    }));
  }, [executionTarget, modelGroups, targetGroups]);

  const hasPickerGroups = pickerGroups.length > 0;

  const effectiveModels = useMemo(() => {
    if (models.length > 0) {
      return models;
    }
    if (currentProvider !== 'claude' && value && value.trim().length > 0) {
      return [{ id: value, label: value }];
    }
    return [] as ModelInfo[];
  }, [currentProvider, models, value]);

  const selectedModelValue = value.trim();
  const targetCurrentModel =
    executionTarget && selectedModelValue.length > 0
      ? pickerGroups
          .find((group) => group.providerId === executionTarget.engine)
          ?.models.find((model) => model.id === selectedModelValue) ?? null
      : null;
  const currentModel =
    targetCurrentModel ??
    (selectedModelValue.length > 0
      ? effectiveModels.find(m => m.id === selectedModelValue) ?? null
      : null);

  const getModelLabel = (model: ModelInfo): string => {
    // Prefer active provider mapping (e.g. kimi-k3) so every tier row shows the
    // real runtime model — mirrors jetbrains-cc-gui ModelSelect behaviour.
    const mappedName = resolveModelMappingValue(model.id, modelMapping);
    if (mappedName) {
      return mappedName;
    }

    const parentLabel = model.label?.trim() || "";
    // Parent/backend already rewrote the label (mapped runtime name, or a
    // curated tier title). Prefer it over static i18n so refresh paths work.
    if (parentLabel) {
      return parentLabel;
    }

    const labelKey = MODEL_LABEL_KEYS[model.id];
    if (labelKey) {
      return t(labelKey);
    }

    return model.id;
  };

  const getModelDescription = (model: ModelInfo): string | undefined => {
    // Always prefer the localized tier subtitle when available, so mapped
    // labels (kimi-k3) still explain which Claude family slot they occupy.
    const descriptionKey = MODEL_DESCRIPTION_KEYS[model.id];
    if (descriptionKey) {
      return t(descriptionKey);
    }
    return model.description;
  };

  const getModelIconId = (model?: ModelInfo | null): string | null =>
    resolveModelIdForIcon(model, modelMapping);
  const currentModelLabel = currentModel ? getModelLabel(currentModel) : t('models.selectModel');
  const hasConfigActions = Boolean(onAddModel || onRefreshConfig);

  const isGroupCurrent = (group: PickerModelGroup): boolean =>
    hasTargetGroups
      ? group.providerId === executionTarget?.engine
      : group.providerId === currentProvider;

  const isGroupModelSelected = (
    group: PickerModelGroup,
    model: ModelInfo,
  ): boolean =>
    hasTargetGroups
      ? group.providerId === executionTarget?.engine &&
        isSelectedExecutionModel(executionTarget, model)
      : group.providerId === currentProvider && model.id === value;

  /**
   * Select model
   */
  const handleSelect = useCallback((modelId: string) => {
    onChange(modelId);
    setIsOpen(false);
  }, [onChange]);

  const handleGroupedSelect = useCallback((providerId: ProviderId, modelId: string) => {
    if (onProviderModelChange) {
      onProviderModelChange(providerId, modelId);
    } else {
      onChange(modelId);
    }
    setIsOpen(false);
  }, [onChange, onProviderModelChange]);

  const handleTargetModelSelect = useCallback(
    (group: PickerModelGroup, model: ModelInfo) => {
      if (!group.targetProfileId) {
        return;
      }
      const runtimeModel = resolveRuntimeModel(model);
      if (!runtimeModel) {
        return;
      }
      onExecutionTargetChange?.(
        buildProviderExecutionTarget(
          executionTarget,
          group.providerId,
          group.targetProfileId,
          model.id,
          group.targetProfileLabel,
          group.targetProfileSource,
          true,
          runtimeModel,
        ),
      );
      setIsOpen(false);
    },
    [executionTarget, onExecutionTargetChange],
  );

  const handlePickerSelect = useCallback(
    (group: PickerModelGroup, model: ModelInfo) => {
      if (hasTargetGroups) {
        handleTargetModelSelect(group, model);
        return;
      }
      handleGroupedSelect(group.providerId, model.id);
    },
    [handleGroupedSelect, handleTargetModelSelect, hasTargetGroups],
  );

  const handleAddModel = useCallback(() => {
    onAddModel?.();
    setIsOpen(false);
  }, [onAddModel]);

  const handleOpenCliSettings = useCallback(() => {
    onOpenCliSettings?.();
    setIsOpen(false);
  }, [onOpenCliSettings]);

  // Refresh keeps the menu open so the spinner / error stay visible.
  const handleRefreshConfig = useCallback(() => {
    if (!onRefreshConfig || isRefreshingConfig) {
      return;
    }
    setRefreshConfigError(null);
    void Promise.resolve(onRefreshConfig()).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      setRefreshConfigError(message);
    });
  }, [isRefreshingConfig, onRefreshConfig]);

  const resolveGroupRefresh = (
    group: PickerModelGroup,
  ): { run: () => void; spinning: boolean } | null => {
    if (group.providerId !== currentProvider) {
      return null;
    }
    if (hasTargetGroups) {
      if (!onReloadProviderConfig || !group.targetProfileId) {
        return null;
      }
      const profileId = group.targetProfileId;
      return {
        run: () => {
          void onReloadProviderConfig(group.providerId, profileId);
        },
        spinning: group.reloading,
      };
    }
    if (!onRefreshConfig) {
      return null;
    }
    return { run: handleRefreshConfig, spinning: isRefreshingConfig };
  };

  // 菜单打开时预取各引擎活跃渠道的模型,保证未展开子菜单前数据已在路上。
  const handleMenuOpenChange = useCallback(
    (nextOpen: boolean) => {
      setIsOpen(nextOpen);
      if (!nextOpen || !hasTargetGroups) {
        return;
      }
      void onOpenTargetCatalog?.();
      pickerGroups.forEach((group) => {
        if (group.enabled && group.targetProfileId) {
          void onOpenProviderProfile?.(group.providerId, group.targetProfileId);
        }
      });
    },
    [
      hasTargetGroups,
      onOpenTargetCatalog,
      onOpenProviderProfile,
      pickerGroups,
    ],
  );

  const trigger = (
    <button
      className={triggerVariant === 'readiness' ? 'composer-readiness-target composer-readiness-target-button' : 'selector-button'}
      title={t('chat.currentModel', { model: currentModelLabel })}
      aria-label={t('chat.currentModel', { model: currentModelLabel })}
    >
      {triggerVariant === 'readiness' ? (
        <>
          <span className="composer-readiness-icon" aria-hidden="true">
            <ModelIcon
              provider={currentProvider}
              model={currentModel}
              modelIdForIcon={getModelIconId(currentModel)}
              size={16}
            />
          </span>
          <span className="composer-readiness-model">
            {currentModelLabel}
          </span>
        </>
      ) : (
        <>
          <ModelIcon
            provider={currentProvider}
            model={currentModel}
            modelIdForIcon={getModelIconId(currentModel)}
            size={12}
          />
          <span className="selector-button-text">{currentModelLabel}</span>
          <span className={`codicon codicon-chevron-${isOpen ? 'up' : 'down'}`} style={{ fontSize: '10px', marginLeft: '2px' }} />
        </>
      )}
    </button>
  );

  const menu = (
    <DropdownMenu open={isOpen} onOpenChange={handleMenuOpenChange}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={4}
        className="max-h-[380px] w-64 overflow-y-auto"
      >
        {hasPickerGroups ? (
          <>
            {hasTargetGroups && targetCatalogError && (
              <div className="px-2 py-1 text-xs text-destructive" role="status">
                {targetCatalogError}
              </div>
            )}
            {pickerGroups.map((group, groupIndex) => {
              const groupRefresh = resolveGroupRefresh(group);
              return (
                <Fragment key={group.providerId}>
                  {groupIndex > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger
                      data-provider-id={group.providerId}
                      data-selected={isGroupCurrent(group) ? 'true' : undefined}
                      disabled={!group.enabled}
                      title={group.disabledReason}
                      className="gap-2"
                    >
                      <ModelIcon provider={group.providerId} size={18} />
                      <span className="min-w-0 flex-1 truncate">{group.providerLabel}</span>
                      {isGroupCurrent(group) && (
                        <CheckIcon className="size-4 shrink-0" aria-hidden />
                      )}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent
                      sideOffset={8}
                      alignOffset={-4}
                      className="max-h-[380px] w-64 overflow-y-auto"
                    >
                      <DropdownMenuLabel className="flex items-center justify-between gap-2 text-muted-foreground">
                        <span className="min-w-0 truncate">
                          {t('models.engineHeader', {
                            name: group.providerLabel,
                            defaultValue: `${group.providerLabel} 引擎`,
                          })}
                        </span>
                        {groupRefresh && (
                          <button
                            type="button"
                            disabled={groupRefresh.spinning}
                            onPointerDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                            }}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                            }}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              groupRefresh.run();
                            }}
                            aria-label={t(groupRefresh.spinning ? 'models.refreshingConfig' : 'models.refreshConfig')}
                            title={t(groupRefresh.spinning ? 'models.refreshingConfig' : 'models.refreshConfig')}
                            className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm text-foreground hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
                          >
                            <span
                              className={`codicon codicon-refresh${groupRefresh.spinning ? ' selector-refresh-icon-spinning' : ''}`}
                              aria-hidden
                            />
                          </button>
                        )}
                      </DropdownMenuLabel>
                      {group.loading && (
                        <DropdownMenuItem disabled>
                          <span
                            className="codicon codicon-loading selector-refresh-icon-spinning"
                            aria-hidden
                          />
                          {t('models.refreshingConfig')}
                        </DropdownMenuItem>
                      )}
                      {!group.loading && group.error && (
                        <DropdownMenuItem disabled className="items-start">
                          <span className="min-w-0 whitespace-normal text-xs text-destructive">
                            {group.error}
                          </span>
                        </DropdownMenuItem>
                      )}
                      {!group.loading &&
                        !group.error &&
                        group.models.length === 0 && (
                          <DropdownMenuItem disabled>
                            {t('models.noModels', {
                              defaultValue: '暂无可用模型',
                            })}
                          </DropdownMenuItem>
                        )}
                      {group.models.map((model) => {
                        const isSelected = isGroupModelSelected(group, model);
                        const description = getModelDescription(model);
                        return (
                          <DropdownMenuItem
                            key={`${group.providerId}:${model.id}`}
                            data-model-id={model.id}
                            data-selected={isSelected ? 'true' : undefined}
                            onSelect={(event) => {
                              event.preventDefault();
                              handlePickerSelect(group, model);
                            }}
                            className="items-start gap-2"
                          >
                            <ModelIcon
                              provider={group.providerId}
                              model={model}
                              modelIdForIcon={getModelIconId(model)}
                              size={18}
                            />
                            <div className="flex min-w-0 flex-1 flex-col">
                              <span className="truncate text-sm">{getModelLabel(model)}</span>
                              {description && (
                                <span className="text-xs text-muted-foreground whitespace-normal">
                                  {description}
                                </span>
                              )}
                            </div>
                            {isSelected && (
                              <CheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                            )}
                          </DropdownMenuItem>
                        );
                      })}
                      {onAddModel && group.providerId === currentProvider && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={(event) => {
                              event.preventDefault();
                              handleAddModel();
                            }}
                          >
                            {t('models.addModel')}
                          </DropdownMenuItem>
                        </>
                      )}
                      {refreshConfigError &&
                        !hasTargetGroups &&
                        group.providerId === currentProvider && (
                          <div className="px-2 py-1 text-xs text-destructive" role="status">
                            {t('models.refreshConfigFailed', { message: refreshConfigError })}
                          </div>
                        )}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </Fragment>
              );
            })}
          </>
        ) : (
          <>
            <DropdownMenuLabel className="text-muted-foreground">
              {t('models.selectModel')}
            </DropdownMenuLabel>
            {effectiveModels.map((model) => {
              const description = getModelDescription(model);
              return (
                <DropdownMenuItem
                  key={model.id}
                  data-model-id={model.id}
                  data-selected={model.id === value ? 'true' : undefined}
                  onSelect={(event) => {
                    event.preventDefault();
                    handleSelect(model.id);
                  }}
                  className="items-start gap-2"
                >
                  <ModelIcon
                    provider={currentProvider}
                    model={model}
                    modelIdForIcon={getModelIconId(model)}
                    size={20}
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm">{getModelLabel(model)}</span>
                    {description && (
                      <span className="text-xs text-muted-foreground whitespace-normal">
                        {description}
                      </span>
                    )}
                  </div>
                  {model.id === value && (
                    <CheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                  )}
                </DropdownMenuItem>
              );
            })}
          </>
        )}
        {hasConfigActions && !hasPickerGroups && (
          <>
            <DropdownMenuSeparator />
            {onAddModel && (
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  handleAddModel();
                }}
              >
                {t('models.addModel')}
              </DropdownMenuItem>
            )}
            {onRefreshConfig && (
              <DropdownMenuItem
                disabled={isRefreshingConfig}
                onSelect={(event) => {
                  event.preventDefault();
                  handleRefreshConfig();
                }}
                title={t(isRefreshingConfig ? 'models.refreshingConfig' : 'models.refreshConfig')}
                className="gap-2"
              >
                <span
                  className={`codicon codicon-refresh${isRefreshingConfig ? ' selector-refresh-icon-spinning' : ''}`}
                  aria-hidden
                />
                <span>{t(isRefreshingConfig ? 'models.refreshingConfig' : 'models.refreshConfig')}</span>
              </DropdownMenuItem>
            )}
            {refreshConfigError && (
              <div className="px-2 py-1 text-xs text-destructive" role="status">
                {t('models.refreshConfigFailed', { message: refreshConfigError })}
              </div>
            )}
          </>
        )}
        {onOpenCliSettings && (
          <>
            <DropdownMenuSeparator />
            <div className="p-1.5 pt-1">
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  handleOpenCliSettings();
                }}
                className="justify-center gap-2 rounded-md border border-border/70 bg-muted/45 font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <Settings2Icon className="size-3.5 shrink-0 opacity-80" aria-hidden />
                <span>{t('models.openCliSettings')}</span>
              </DropdownMenuItem>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return triggerVariant === 'readiness' ? (
    <div className="composer-readiness-model-select">{menu}</div>
  ) : (
    menu
  );
});

export default ModelSelect;
