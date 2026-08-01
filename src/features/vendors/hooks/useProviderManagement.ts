import { useState, useCallback, useEffect, useMemo } from "react";
import type { ClaudeCurrentConfig, ProviderConfig } from "../types";
import { LOCAL_SETTINGS_PROVIDER_ID } from "../types";
import {
  getClaudeProviders,
  addClaudeProvider,
  updateClaudeProvider,
  deleteClaudeProvider,
  reorderClaudeProviders,
  getCurrentClaudeConfig,
  switchClaudeProvider,
} from "../../../services/tauri";
import {
  migrateModelMappingStorage,
  syncModelMappingFromProviderEnv,
} from "../../models/constants";
import { VENDOR_ACTIVE_PROVIDER_CHANGED_EVENT } from "../vendorActiveProviderEvents";
import { notifyProviderTargetCatalogChanged } from "../../composer/components/ChatInputBox/hooks/useProviderTargetCatalogOwners";

export interface ProviderDialogState {
  isOpen: boolean;
  provider: ProviderConfig | null;
}

export interface DeleteConfirmState {
  isOpen: boolean;
  provider: ProviderConfig | null;
}

export type ClaudeProviderAction =
  | "load"
  | "save"
  | "reorder"
  | "delete"
  | "switch"
  | "storage";

export type ClaudeProviderActionError = Readonly<{
  action: ClaudeProviderAction;
  message: string;
  cause: unknown;
}>;

export type ClaudeProviderActionResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; error: ClaudeProviderActionError }>;

function providerActionError(
  action: ClaudeProviderAction,
  cause: unknown,
): ClaudeProviderActionError {
  const detail =
    cause instanceof Error
      ? cause.message
      : typeof cause === "string"
        ? cause
        : "Unknown error";
  return Object.freeze({
    action,
    message: `Claude provider ${action} failed: ${detail}`,
    cause,
  });
}

export function useProviderManagement() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<ClaudeCurrentConfig | null>(
    null,
  );
  const [currentConfigLoading, setCurrentConfigLoading] = useState(false);
  const [providerError, setProviderError] =
    useState<ClaudeProviderActionError | null>(null);

  const [providerDialog, setProviderDialog] = useState<ProviderDialogState>({
    isOpen: false,
    provider: null,
  });
  const [claudeSettingsJsonDialogOpen, setClaudeSettingsJsonDialogOpen] =
    useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>({
    isOpen: false,
    provider: null,
  });

  /**
   * Mirror jetbrains-cc-gui: when the active Claude provider changes, push its
   * ANTHROPIC_DEFAULT_* env slots into localStorage so the model picker can
   * show mapped names (e.g. kimi-k3) and brand icons.
   */
  const syncActiveProviderModelMapping = useCallback(
    (providerList: ProviderConfig[]) => {
      const active =
        providerList.find((provider) => provider.isActive) ??
        providerList.find(
          (provider) =>
            provider.id === LOCAL_SETTINGS_PROVIDER_ID ||
            provider.isLocalProvider,
        ) ??
        null;
      const env = active?.settingsConfig?.env as
        | Record<string, unknown>
        | undefined;
      const result = syncModelMappingFromProviderEnv(env);
      if (!result.ok) {
        setProviderError(providerActionError("storage", result.error));
      } else if (result.warnings.length > 0) {
        setProviderError(
          providerActionError("storage", result.warnings.join("; ")),
        );
      }
    },
    [],
  );

  const loadProviders = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getClaudeProviders();
      setProviders(list);
      syncActiveProviderModelMapping(list);
      return { ok: true } as const;
    } catch (error) {
      const actionError =
        typeof error === "object" && error !== null && "action" in error
          ? (error as ClaudeProviderActionError)
          : providerActionError("load", error);
      setProviderError(actionError);
      return { ok: false, error: actionError } as const;
    } finally {
      setLoading(false);
    }
  }, [syncActiveProviderModelMapping]);

  const loadCurrentConfig = useCallback(async () => {
    setCurrentConfigLoading(true);
    try {
      const config = await getCurrentClaudeConfig();
      setCurrentConfig(config as ClaudeCurrentConfig);
      return { ok: true } as const;
    } catch (error) {
      setCurrentConfig(null);
      const actionError = providerActionError("load", error);
      setProviderError(actionError);
      return { ok: false, error: actionError } as const;
    } finally {
      setCurrentConfigLoading(false);
    }
  }, []);

  useEffect(() => {
    const migration = migrateModelMappingStorage();
    if (migration.warnings.length > 0) {
      setProviderError(
        providerActionError("storage", migration.warnings.join("; ")),
      );
    }
    void Promise.all([loadProviders(), loadCurrentConfig()]);
  }, [loadProviders, loadCurrentConfig]);

  // 新建菜单选供应商并 switch 后，刷新「使用中」标记（与设置页点启用一致）
  useEffect(() => {
    const onActiveProviderChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ engine?: string }>).detail;
      if (detail?.engine && detail.engine !== "claude") {
        return;
      }
      void Promise.all([loadProviders(), loadCurrentConfig()]);
    };
    window.addEventListener(
      VENDOR_ACTIVE_PROVIDER_CHANGED_EVENT,
      onActiveProviderChanged,
    );
    return () => {
      window.removeEventListener(
        VENDOR_ACTIVE_PROVIDER_CHANGED_EVENT,
        onActiveProviderChanged,
      );
    };
  }, [loadProviders, loadCurrentConfig]);

  const handleEditProvider = useCallback((provider: ProviderConfig) => {
    setProviderDialog({ isOpen: true, provider });
  }, []);

  const handleAddProvider = useCallback(() => {
    setProviderDialog({ isOpen: true, provider: null });
  }, []);

  const handleCloseProviderDialog = useCallback(() => {
    setProviderDialog({ isOpen: false, provider: null });
  }, []);

  const handleOpenClaudeSettingsJsonDialog = useCallback(() => {
    setClaudeSettingsJsonDialogOpen(true);
  }, []);

  const handleCloseClaudeSettingsJsonDialog = useCallback(() => {
    setClaudeSettingsJsonDialogOpen(false);
  }, []);

  const handleClaudeSettingsJsonSaved = useCallback(() => {
    void Promise.all([loadProviders(), loadCurrentConfig()]).then(() => {
      notifyProviderTargetCatalogChanged();
    });
  }, [loadProviders, loadCurrentConfig]);

  const handleSaveProvider = useCallback(
    async (data: {
      providerName: string;
      remark: string;
      apiKey: string;
      apiUrl: string;
      jsonConfig: string;
    }) => {
      if (!data.providerName) {
        const error = providerActionError("save", "Provider name is required");
        setProviderError(error);
        return { ok: false, error } as const;
      }

      let parsedConfig;
      try {
        parsedConfig = JSON.parse(data.jsonConfig || "{}");
      } catch (cause) {
        const error = providerActionError("save", cause);
        setProviderError(error);
        return { ok: false, error } as const;
      }

      const updates = {
        name: data.providerName,
        remark: data.remark,
        websiteUrl: null,
        settingsConfig: parsedConfig,
      };

      const isAdding = !providerDialog.provider;

      try {
        if (isAdding) {
          const newProvider = {
            id: crypto.randomUUID
              ? crypto.randomUUID()
              : Date.now().toString(),
            ...updates,
          };
          await addClaudeProvider(newProvider);
        } else {
          const providerId = providerDialog.provider!.id;
          const currentProvider =
            providers.find((p) => p.id === providerId) ||
            providerDialog.provider!;

          await updateClaudeProvider(providerId, {
            ...currentProvider,
            ...updates,
          });
        }

        setProviderDialog({ isOpen: false, provider: null });
        await Promise.all([loadProviders(), loadCurrentConfig()]);
        setProviderError(null);
        notifyProviderTargetCatalogChanged();
        return { ok: true } as const;
      } catch (cause) {
        const error =
          typeof cause === "object" && cause !== null && "action" in cause
            ? (cause as ClaudeProviderActionError)
            : providerActionError("save", cause);
        setProviderError(error);
        return { ok: false, error } as const;
      }
    },
    [
      providerDialog.provider,
      providers,
      loadProviders,
      loadCurrentConfig,
    ],
  );

  const handleReorderProviders = useCallback(
    async (orderedIds: string[]) => {
      const localProviders = providers.filter(
        (provider) =>
          provider.id === LOCAL_SETTINGS_PROVIDER_ID || provider.isLocalProvider,
      );
      const regularById = new Map(
        providers
          .filter(
            (provider) =>
              provider.id !== LOCAL_SETTINGS_PROVIDER_ID &&
              !provider.isLocalProvider,
          )
          .map((provider) => [provider.id, provider]),
      );
      const orderedRegularProviders = orderedIds
        .map((id) => regularById.get(id))
        .filter((provider): provider is ProviderConfig => Boolean(provider));

      setProviders([...localProviders, ...orderedRegularProviders]);

      try {
        await reorderClaudeProviders(orderedIds);
        // Success: the optimistic order already matches what the backend
        // persisted (reorder only writes sortOrder, never changes the active
        // provider), so keep it as-is. Refetching here would toggle the loading
        // flag and replace every provider object reference right after the drop
        // settles, causing a visible flicker on each reorder.
        setProviderError(null);
        return { ok: true } as const;
      } catch (cause) {
        // Persistence failed: reload from backend to roll back the optimistic order.
        await loadProviders();
        const error = providerActionError("reorder", cause);
        setProviderError(error);
        return { ok: false, error } as const;
      }
    },
    [providers, loadProviders],
  );

  const handleDeleteProvider = useCallback((provider: ProviderConfig) => {
    setDeleteConfirm({ isOpen: true, provider });
  }, []);

  /**
   * L1「启用 / 使用中」：只更新 app 内 claude.current（backend 不再盖写 ~/.claude/settings.json）。
   * managed 会话 env 靠 thread.providerProfileId + launch/--settings；本地 settings 保持用户磁盘原样。
   * 设置页与新建菜单共用此路径；已绑定会话的 L2 binding 不会被改写。
   */
  const handleSwitchProvider = useCallback(
    async (id: string) => {
      try {
        await switchClaudeProvider(id);
        await Promise.all([loadProviders(), loadCurrentConfig()]);
        setProviderError(null);
        notifyProviderTargetCatalogChanged();
        return { ok: true } as const;
      } catch (cause) {
        const error = providerActionError("switch", cause);
        setProviderError(error);
        return { ok: false, error } as const;
      }
    },
    [loadProviders, loadCurrentConfig],
  );

  const confirmDeleteProvider = useCallback(async () => {
    const provider = deleteConfirm.provider;
    if (!provider) return;

    try {
      await deleteClaudeProvider(provider.id);
      await Promise.all([loadProviders(), loadCurrentConfig()]);
      setProviderError(null);
      notifyProviderTargetCatalogChanged();
      setDeleteConfirm({ isOpen: false, provider: null });
      return { ok: true } as const;
    } catch (cause) {
      const error = providerActionError("delete", cause);
      setProviderError(error);
      setDeleteConfirm({ isOpen: false, provider: null });
      return { ok: false, error } as const;
    }
  }, [deleteConfirm.provider, loadProviders, loadCurrentConfig]);

  const cancelDeleteProvider = useCallback(() => {
    setDeleteConfirm({ isOpen: false, provider: null });
  }, []);

  const localProvider = useMemo(
    () =>
      providers.find(
        (provider) =>
          provider.id === LOCAL_SETTINGS_PROVIDER_ID ||
          provider.isLocalProvider,
      ) ?? null,
    [providers],
  );

  return {
    providers,
    localProvider,
    loading,
    currentConfig,
    currentConfigLoading,
    providerError,
    providerDialog,
    claudeSettingsJsonDialogOpen,
    deleteConfirm,
    loadProviders,
    loadCurrentConfig,
    handleEditProvider,
    handleAddProvider,
    handleCloseProviderDialog,
    handleOpenClaudeSettingsJsonDialog,
    handleCloseClaudeSettingsJsonDialog,
    handleClaudeSettingsJsonSaved,
    handleSaveProvider,
    handleReorderProviders,
    handleSwitchProvider,
    handleDeleteProvider,
    confirmDeleteProvider,
    cancelDeleteProvider,
  };
}

export type UseProviderManagementReturn = ReturnType<
  typeof useProviderManagement
>;
