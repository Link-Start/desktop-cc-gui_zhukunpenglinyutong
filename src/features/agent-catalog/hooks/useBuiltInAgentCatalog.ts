import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  listBuiltInAgents,
  setBuiltInAgentDivisionEnabled,
  setBuiltInAgentEnabled,
} from "../../../services/tauri";
import type { AppSettings, BuiltInAgentCatalog } from "../../../types";
import { BUILT_IN_AGENT_CATALOG_CHANGED_EVENT } from "../events";

type UseBuiltInAgentCatalogOptions = {
  active: boolean;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
};

export function useBuiltInAgentCatalog({
  active,
  onUpdateAppSettings,
}: UseBuiltInAgentCatalogOptions) {
  const { i18n } = useTranslation();
  const [catalog, setCatalog] = useState<BuiltInAgentCatalog | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const loadSequenceRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      loadSequenceRef.current += 1;
    };
  }, []);

  const loadCatalog = useCallback(async () => {
    if (!active) {
      return;
    }
    const loadSequence = loadSequenceRef.current + 1;
    loadSequenceRef.current = loadSequence;
    setLoading(true);
    setError(null);
    try {
      const nextCatalog = await listBuiltInAgents(
        i18n.resolvedLanguage ?? i18n.language,
      );
      if (
        mountedRef.current
        && loadSequence === loadSequenceRef.current
      ) {
        setCatalog(nextCatalog);
      }
    } catch (loadError) {
      if (
        mountedRef.current
        && loadSequence === loadSequenceRef.current
      ) {
        setError(
          loadError instanceof Error ? loadError.message : String(loadError),
        );
      }
    } finally {
      if (
        mountedRef.current
        && loadSequence === loadSequenceRef.current
      ) {
        setLoading(false);
      }
    }
  }, [active, i18n.language, i18n.resolvedLanguage]);

  useEffect(() => {
    void loadCatalog();
    return () => {
      loadSequenceRef.current += 1;
    };
  }, [loadCatalog]);

  const commitSettings = useCallback(
    async (next: AppSettings) => {
      await onUpdateAppSettings(next);
      window.dispatchEvent(new Event(BUILT_IN_AGENT_CATALOG_CHANGED_EVENT));
      await loadCatalog();
    },
    [loadCatalog, onUpdateAppSettings],
  );

  const setAgentEnabled = useCallback(
    async (agentId: string, enabled: boolean) => {
      setPendingKey(agentId);
      setError(null);
      try {
        await commitSettings(await setBuiltInAgentEnabled(agentId, enabled));
      } catch (toggleError) {
        if (mountedRef.current) {
          setError(
            toggleError instanceof Error ? toggleError.message : String(toggleError),
          );
        }
      } finally {
        if (mountedRef.current) {
          setPendingKey(null);
        }
      }
    },
    [commitSettings],
  );

  const setDivisionEnabled = useCallback(
    async (divisionId: string, enabled: boolean) => {
      const key = `division:${divisionId}`;
      setPendingKey(key);
      setError(null);
      try {
        await commitSettings(
          await setBuiltInAgentDivisionEnabled(divisionId, enabled),
        );
      } catch (toggleError) {
        if (mountedRef.current) {
          setError(
            toggleError instanceof Error ? toggleError.message : String(toggleError),
          );
        }
      } finally {
        if (mountedRef.current) {
          setPendingKey(null);
        }
      }
    },
    [commitSettings],
  );

  return {
    catalog,
    loading,
    pendingKey,
    error,
    loadCatalog,
    setAgentEnabled,
    setDivisionEnabled,
  };
}
