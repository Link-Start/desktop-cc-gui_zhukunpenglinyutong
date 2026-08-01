import { useState, useCallback, useEffect } from "react";
import type { KimiCurrentConfig, KimiProviderConfig } from "../types";
import {
  getKimiProviders,
  getCurrentKimiConfig,
  addKimiProvider,
  updateKimiProvider,
  deleteKimiProvider,
  switchKimiProvider,
} from "../../../services/tauri";
import { VENDOR_ACTIVE_PROVIDER_CHANGED_EVENT } from "../vendorActiveProviderEvents";

export interface KimiProviderDialogState {
  isOpen: boolean;
  provider: KimiProviderConfig | null;
}

export interface DeleteKimiConfirmState {
  isOpen: boolean;
  provider: KimiProviderConfig | null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }
  return fallback;
}

export function useKimiProviderManagement() {
  const [kimiProviders, setKimiProviders] = useState<KimiProviderConfig[]>([]);
  const [kimiLoading, setKimiLoading] = useState(false);
  const [kimiProviderError, setKimiProviderError] = useState<string | null>(
    null,
  );
  const [currentKimiConfig, setCurrentKimiConfig] =
    useState<KimiCurrentConfig | null>(null);

  const [kimiProviderDialog, setKimiProviderDialog] =
    useState<KimiProviderDialogState>({
      isOpen: false,
      provider: null,
    });

  const [deleteKimiConfirm, setDeleteKimiConfirm] =
    useState<DeleteKimiConfirmState>({
      isOpen: false,
      provider: null,
    });

  const loadKimiProviders = useCallback(async () => {
    setKimiLoading(true);
    try {
      const list = await getKimiProviders();
      setKimiProviders(list);
      setKimiProviderError(null);
    } catch (error) {
      setKimiProviderError(
        getErrorMessage(error, "Failed to load Kimi providers."),
      );
    } finally {
      setKimiLoading(false);
    }
    // 当前配置刷新失败不阻塞 provider 列表。
    try {
      const config = await getCurrentKimiConfig();
      setCurrentKimiConfig(config);
      if (
        config.configStatus === "malformed" ||
        config.configStatus === "io-error"
      ) {
        setKimiProviderError(
          config.diagnostic ?? `Kimi config is ${config.configStatus}.`,
        );
      }
    } catch (error) {
      setCurrentKimiConfig(null);
      setKimiProviderError(
        getErrorMessage(error, "Failed to inspect Kimi config."),
      );
    }
  }, []);

  useEffect(() => {
    void loadKimiProviders();
  }, [loadKimiProviders]);

  useEffect(() => {
    const onActiveProviderChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ engine?: string }>).detail;
      if (detail?.engine && detail.engine !== "kimi") {
        return;
      }
      void loadKimiProviders();
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
  }, [loadKimiProviders]);

  const handleAddKimiProvider = useCallback(() => {
    setKimiProviderDialog({ isOpen: true, provider: null });
  }, []);

  const handleEditKimiProvider = useCallback(
    (provider: KimiProviderConfig) => {
      setKimiProviderDialog({ isOpen: true, provider });
    },
    [],
  );

  const handleCloseKimiProviderDialog = useCallback(() => {
    setKimiProviderDialog({ isOpen: false, provider: null });
  }, []);

  const handleSaveKimiProvider = useCallback(
    async (providerData: KimiProviderConfig) => {
      const isAdding = !kimiProviderDialog.provider;

      try {
        if (isAdding) {
          await addKimiProvider(providerData);
        } else {
          await updateKimiProvider(providerData.id, providerData);
        }

        setKimiProviderDialog({ isOpen: false, provider: null });
        setKimiProviderError(null);
        await loadKimiProviders();
      } catch (error) {
        setKimiProviderError(
          getErrorMessage(error, "Failed to save Kimi provider."),
        );
      }
    },
    [kimiProviderDialog.provider, loadKimiProviders],
  );

  const handleSwitchKimiProvider = useCallback(
    async (id: string) => {
      try {
        await switchKimiProvider(id);
        setKimiProviderError(null);
        await loadKimiProviders();
      } catch (error) {
        setKimiProviderError(
          getErrorMessage(error, "Failed to switch Kimi provider."),
        );
      }
    },
    [loadKimiProviders],
  );

  const handleDeleteKimiProvider = useCallback(
    (provider: KimiProviderConfig) => {
      setDeleteKimiConfirm({ isOpen: true, provider });
    },
    [],
  );

  const confirmDeleteKimiProvider = useCallback(async () => {
    const provider = deleteKimiConfirm.provider;
    if (!provider) return;

    try {
      const result = await deleteKimiProvider(provider.id);
      await loadKimiProviders();
      setKimiProviderError(
        result.status === "partial-warning"
          ? result.warning ?? "Kimi provider deleted with residual config."
          : null,
      );
    } catch (error) {
      setKimiProviderError(
        getErrorMessage(error, "Failed to delete Kimi provider."),
      );
    }
    setDeleteKimiConfirm({ isOpen: false, provider: null });
  }, [deleteKimiConfirm.provider, loadKimiProviders]);

  const cancelDeleteKimiProvider = useCallback(() => {
    setDeleteKimiConfirm({ isOpen: false, provider: null });
  }, []);

  return {
    kimiProviders,
    kimiLoading,
    kimiProviderError,
    kimiProviderDialog,
    deleteKimiConfirm,
    currentKimiConfig,
    loadKimiProviders,
    handleAddKimiProvider,
    handleEditKimiProvider,
    handleCloseKimiProviderDialog,
    handleSaveKimiProvider,
    handleSwitchKimiProvider,
    handleDeleteKimiProvider,
    confirmDeleteKimiProvider,
    cancelDeleteKimiProvider,
  };
}

export type UseKimiProviderManagementReturn = ReturnType<
  typeof useKimiProviderManagement
>;
