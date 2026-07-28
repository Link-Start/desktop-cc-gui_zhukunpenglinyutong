import { Fragment, memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CheckIcon from 'lucide-react/dist/esm/icons/check';
import type { ModelInfo, ProviderId } from '../types';
import type { ProviderModelGroup } from '../modelOptions';
import type {
  ProviderTargetGroup,
} from '../hooks/useSharedProviderTargetCatalog';
import type { ExecutionTarget } from '../../../../shared-session/target/types';
import {
  CLAUDE_LOCAL_PROVIDER_PROFILE_ID,
  CODEX_DISK_PROVIDER_PROFILE_ID,
  KIMI_LOCAL_PROVIDER_PROFILE_ID,
} from '../../../../threads/constants/codexProviderProfiles';
import { EngineIcon } from '../../../../engine/components/EngineIcon';
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
  targetGroups?: ProviderTargetGroup[];
  executionTarget?: ExecutionTarget | null;
  onExecutionTargetChange?: (target: ExecutionTarget) => void;
  onOpenTargetCatalog?: () => Promise<void> | void;
  onOpenProviderProfile?: (
    providerId: ProviderId,
    providerProfileId: string,
  ) => Promise<void> | void;
  targetCatalogError?: string | null;
  onProviderModelChange?: (providerId: ProviderId, modelId: string) => void;
  onAddModel?: () => void;  // Navigate to model management
  onRefreshConfig?: () => Promise<void> | void; // Refresh current provider config
  isRefreshingConfig?: boolean;
}

const MODEL_LABEL_KEYS: Record<string, string> = {
  'gpt-5.6-sol': 'models.codex.gpt56sol.label',
  'gpt-5.6-terra': 'models.codex.gpt56terra.label',
  'gpt-5.6-luna': 'models.codex.gpt56luna.label',
  'gpt-5.5': 'models.codex.gpt55.label',
  'gpt-5.4': 'models.codex.gpt54.label',
};

const MODEL_DESCRIPTION_KEYS: Record<string, string> = {
  'gpt-5.6-sol': 'models.codex.gpt56sol.description',
  'gpt-5.6-terra': 'models.codex.gpt56terra.description',
  'gpt-5.6-luna': 'models.codex.gpt56luna.description',
  'gpt-5.5': 'models.codex.gpt55.description',
  'gpt-5.4': 'models.codex.gpt54.description',
};

const LOCAL_PROVIDER_PROFILE_IDS: Partial<Record<ProviderId, string>> = {
  claude: CLAUDE_LOCAL_PROVIDER_PROFILE_ID,
  codex: CODEX_DISK_PROVIDER_PROFILE_ID,
  kimi: KIMI_LOCAL_PROVIDER_PROFILE_ID,
};

function normalizeExecutionProviderProfileId(
  providerId: ProviderId,
  providerProfileId: string,
): string | null {
  return LOCAL_PROVIDER_PROFILE_IDS[providerId] === providerProfileId
    ? null
    : providerProfileId;
}

export function buildProviderExecutionTarget(
  current: ExecutionTarget | null | undefined,
  providerId: ProviderId,
  providerProfileId: string,
  modelId: string,
): ExecutionTarget {
  const normalizedProviderProfileId = normalizeExecutionProviderProfileId(
    providerId,
    providerProfileId,
  );
  return {
    engine: providerId,
    providerProfileId: normalizedProviderProfileId,
    model: modelId,
    reasoning:
      current?.engine === providerId &&
      current.providerProfileId === normalizedProviderProfileId
        ? current.reasoning ?? null
        : null,
  };
}

function isSelectedProviderProfile(
  executionTarget: ExecutionTarget | null | undefined,
  providerId: ProviderId,
  providerProfileId: string,
): boolean {
  const normalizedProviderProfileId = normalizeExecutionProviderProfileId(
    providerId,
    providerProfileId,
  );
  return (
    executionTarget?.engine === providerId &&
    (executionTarget.providerProfileId ?? null) ===
      normalizedProviderProfileId
  );
}

/**
 * Model icon component - displays different icons based on provider type
 */
const ModelIcon = ({ provider, size = 16 }: { provider?: string; size?: number }) => {
  const imgStyle = { width: size, height: size, flexShrink: 0 } as const;
  switch (provider) {
    case 'codex':
      return <EngineIcon engine="codex" size={size} style={imgStyle} />;
    case 'gemini':
      return <EngineIcon engine="gemini" size={size} style={imgStyle} />;
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
  targetGroups,
  executionTarget,
  onExecutionTargetChange,
  onOpenTargetCatalog,
  onOpenProviderProfile,
  targetCatalogError,
  onProviderModelChange,
  onAddModel,
  onRefreshConfig,
  isRefreshingConfig = false,
}: ModelSelectProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [refreshConfigError, setRefreshConfigError] = useState<string | null>(null);

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
      ? targetGroups
          ?.find((group) => group.providerId === executionTarget.engine)
          ?.profiles.find((profile) =>
            isSelectedProviderProfile(
              executionTarget,
              executionTarget.engine,
              profile.id,
            ),
          )
          ?.models.find((model) => model.id === selectedModelValue) ?? null
      : null;
  const currentModel =
    targetCurrentModel ??
    (selectedModelValue.length > 0
      ? effectiveModels.find(m => m.id === selectedModelValue) ?? null
      : null);

  const getModelLabel = (model: ModelInfo): string => {
    // The parent owns refreshed provider/model mapping. Keep this selector
    // presentational so manual config refreshes can update labels immediately.
    const labelKey = MODEL_LABEL_KEYS[model.id];

    if (labelKey) {
      return t(labelKey);
    }

    return model.label;
  };

  const getModelDescription = (model: ModelInfo): string | undefined => {
    const descriptionKey = MODEL_DESCRIPTION_KEYS[model.id];
    if (descriptionKey) {
      return t(descriptionKey);
    }
    return model.description;
  };
  const currentModelLabel = currentModel ? getModelLabel(currentModel) : t('models.selectModel');
  const resolvedTargetGroups = targetGroups ?? [];
  const hasTargetGroups = resolvedTargetGroups.length > 0;
  const hasGroupedModels = Boolean(modelGroups && modelGroups.length > 0);
  const hasConfigActions = Boolean(onAddModel || onRefreshConfig);

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

  const handleTargetSelect = useCallback(
    (
      providerId: ProviderId,
      providerProfileId: string,
      modelId: string,
    ) => {
      if (!onExecutionTargetChange) {
        return;
      }
      onExecutionTargetChange(
        buildProviderExecutionTarget(
          executionTarget,
          providerId,
          providerProfileId,
          modelId,
        ),
      );
      setIsOpen(false);
    },
    [executionTarget, onExecutionTargetChange],
  );

  const handleAddModel = useCallback(() => {
    onAddModel?.();
    setIsOpen(false);
  }, [onAddModel]);

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

  const trigger = (
    <button
      className={triggerVariant === 'readiness' ? 'composer-readiness-target composer-readiness-target-button' : 'selector-button'}
      title={t('chat.currentModel', { model: currentModelLabel })}
      aria-label={t('chat.currentModel', { model: currentModelLabel })}
    >
      {triggerVariant === 'readiness' ? (
        <>
          <span className="composer-readiness-icon" aria-hidden="true">
            <ModelIcon provider={currentProvider} size={16} />
          </span>
          <span className="composer-readiness-model">
            {currentModelLabel}
          </span>
        </>
      ) : (
        <>
          <ModelIcon provider={currentProvider} size={12} />
          <span className="selector-button-text">{currentModelLabel}</span>
          <span className={`codicon codicon-chevron-${isOpen ? 'up' : 'down'}`} style={{ fontSize: '10px', marginLeft: '2px' }} />
        </>
      )}
    </button>
  );

  const menu = (
    <DropdownMenu
      open={isOpen}
      onOpenChange={(nextOpen) => {
        setIsOpen(nextOpen);
        if (nextOpen) {
          void onOpenTargetCatalog?.();
        }
      }}
    >
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={4}
        className="max-h-[380px] w-64 overflow-y-auto"
      >
        {hasTargetGroups ? (
          <>
            {resolvedTargetGroups.map((group, groupIndex) => (
              <Fragment key={group.providerId}>
                {groupIndex > 0 && <DropdownMenuSeparator />}
                {!group.enabled ? (
                  <DropdownMenuItem
                    disabled
                    data-provider-id={group.providerId}
                    title={group.disabledReason}
                    className="items-start gap-2"
                  >
                    <ModelIcon provider={group.providerId} size={18} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{group.providerLabel}</span>
                      {group.disabledReason && (
                        <span className="block whitespace-normal text-xs text-muted-foreground">
                          {group.disabledReason}
                        </span>
                      )}
                    </span>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger
                      data-provider-id={group.providerId}
                      data-selected={
                        executionTarget?.engine === group.providerId
                          ? 'true'
                          : undefined
                      }
                      className="gap-2"
                      onMouseEnter={() => {
                        group.profiles.forEach((profile) => {
                          void onOpenProviderProfile?.(
                            group.providerId,
                            profile.id,
                          );
                        });
                      }}
                    >
                      <ModelIcon provider={group.providerId} size={18} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">
                          {group.providerLabel}
                        </span>
                      </span>
                      {executionTarget?.engine === group.providerId && (
                        <CheckIcon className="size-4 shrink-0" aria-hidden />
                      )}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent
                      sideOffset={8}
                      alignOffset={-4}
                      className="max-h-[380px] w-72 overflow-y-auto"
                    >
                      <DropdownMenuLabel className="text-muted-foreground">
                        {group.providerLabel} · Provider
                      </DropdownMenuLabel>
                      {group.profiles.map((profile, profileIndex) => (
                        <Fragment key={`${group.providerId}:${profile.id}`}>
                          {profileIndex > 0 && <DropdownMenuSeparator />}
                          <DropdownMenuLabel
                            className="flex min-w-0 items-center gap-2 text-muted-foreground"
                            data-provider-profile-id={profile.id}
                          >
                            <span className="codicon codicon-server-environment shrink-0" aria-hidden />
                            <span className="min-w-0 flex-1 truncate">
                              {profile.label}
                            </span>
                            {isSelectedProviderProfile(
                              executionTarget,
                              group.providerId,
                              profile.id,
                            ) && (
                              <CheckIcon className="size-4 shrink-0" aria-hidden />
                            )}
                          </DropdownMenuLabel>
                          {profile.loading && (
                            <DropdownMenuItem disabled>
                              <span className="codicon codicon-loading selector-refresh-icon-spinning" aria-hidden />
                              {t('models.refreshingConfig')}
                            </DropdownMenuItem>
                          )}
                          {!profile.loading && profile.error && (
                            <DropdownMenuItem disabled className="items-start">
                              <span className="min-w-0 whitespace-normal text-xs text-destructive">
                                {profile.error}
                              </span>
                            </DropdownMenuItem>
                          )}
                          {!profile.loading &&
                            !profile.error &&
                            profile.models.length === 0 && (
                              <DropdownMenuItem disabled>
                                {t('models.noModels', {
                                  defaultValue: '暂无可用模型',
                                })}
                              </DropdownMenuItem>
                            )}
                          {profile.models.map((model) => {
                            const isSelected =
                              isSelectedProviderProfile(
                                executionTarget,
                                group.providerId,
                                profile.id,
                              ) &&
                              executionTarget?.model === model.id;
                            return (
                              <DropdownMenuItem
                                key={`${group.providerId}:${profile.id}:${model.id}`}
                                className="gap-2 pl-7"
                                onSelect={() =>
                                  handleTargetSelect(
                                    group.providerId,
                                    profile.id,
                                    model.id,
                                  )
                                }
                              >
                                <ModelIcon provider={group.providerId} size={16} />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate">
                                    {getModelLabel(model)}
                                  </span>
                                  {getModelDescription(model) && (
                                    <span className="block truncate text-xs text-muted-foreground">
                                      {getModelDescription(model)}
                                    </span>
                                  )}
                                </span>
                                {isSelected && (
                                  <CheckIcon className="size-4 shrink-0" aria-hidden />
                                )}
                              </DropdownMenuItem>
                            );
                          })}
                        </Fragment>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
              </Fragment>
            ))}
            {targetCatalogError && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled className="items-start">
                  <span className="whitespace-normal text-xs text-destructive">
                    {targetCatalogError}
                  </span>
                </DropdownMenuItem>
              </>
            )}
          </>
        ) : hasGroupedModels ? (
          modelGroups!.map((group, groupIndex) => (
            <Fragment key={group.providerId}>
              {groupIndex > 0 && <DropdownMenuSeparator />}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger
                  data-provider-id={group.providerId}
                  data-selected={group.providerId === currentProvider ? 'true' : undefined}
                  className="gap-2"
                >
                  <ModelIcon provider={group.providerId} size={18} />
                  <span className="min-w-0 flex-1 truncate">{group.providerLabel}</span>
                  {group.providerId === currentProvider && (
                    <CheckIcon className="size-4 shrink-0" aria-hidden />
                  )}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  sideOffset={8}
                  alignOffset={-4}
                  className="max-h-[380px] w-64 overflow-y-auto"
                >
                  <DropdownMenuLabel className="flex items-center justify-between gap-2 text-muted-foreground">
                    <span className="min-w-0 truncate">{group.providerLabel}</span>
                    {onRefreshConfig && group.providerId === currentProvider && (
                      <button
                        type="button"
                        disabled={isRefreshingConfig}
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
                          handleRefreshConfig();
                        }}
                        aria-label={t(isRefreshingConfig ? 'models.refreshingConfig' : 'models.refreshConfig')}
                        title={t(isRefreshingConfig ? 'models.refreshingConfig' : 'models.refreshConfig')}
                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm text-foreground hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
                      >
                        <span
                          className={`codicon codicon-refresh${isRefreshingConfig ? ' selector-refresh-icon-spinning' : ''}`}
                          aria-hidden
                        />
                      </button>
                    )}
                  </DropdownMenuLabel>
                  {group.models.map((model) => {
                    const isSelected = group.providerId === currentProvider && model.id === value;
                    return (
                      <DropdownMenuItem
                        key={`${group.providerId}:${model.id}`}
                        data-model-id={model.id}
                        data-selected={isSelected ? 'true' : undefined}
                        onSelect={(event) => {
                          event.preventDefault();
                          handleGroupedSelect(group.providerId, model.id);
                        }}
                        className="gap-2"
                      >
                        <ModelIcon provider={group.providerId} size={18} />
                        <span className="min-w-0 flex-1 truncate">{getModelLabel(model)}</span>
                        {isSelected && <CheckIcon className="size-4 shrink-0" aria-hidden />}
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
                  {refreshConfigError && group.providerId === currentProvider && (
                    <div className="px-2 py-1 text-xs text-destructive" role="status">
                      {t('models.refreshConfigFailed', { message: refreshConfigError })}
                    </div>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </Fragment>
          ))
        ) : (
          <>
            <DropdownMenuLabel className="text-muted-foreground">
              {t('models.selectModel')}
            </DropdownMenuLabel>
            {effectiveModels.map((model) => (
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
                <ModelIcon provider={currentProvider} size={20} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm">{getModelLabel(model)}</span>
                  {getModelDescription(model) && (
                    <span className="text-xs text-muted-foreground whitespace-normal">
                      {getModelDescription(model)}
                    </span>
                  )}
                </div>
                {model.id === value && <CheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />}
              </DropdownMenuItem>
            ))}
          </>
        )}
        {hasConfigActions && !hasGroupedModels && (
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
