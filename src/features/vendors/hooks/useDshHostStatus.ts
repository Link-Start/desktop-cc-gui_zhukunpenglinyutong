import { useCallback, useEffect, useMemo, useState } from "react";
import type { CodexDoctorResult } from "../../../types";
import { cancelDshHost, ensureDshHost, runDshDoctor } from "../../../services/tauri";
import {
  mapDshDoctorToHostView,
  type DshHostViewModel,
} from "../utils/dshHostStatus";

type UseDshHostStatusOptions = {
  enabled: boolean;
  dshBin: string | null;
  host: string | null | undefined;
  port: number | null | undefined;
};

export function useDshHostStatus({
  enabled,
  dshBin,
  host,
  port,
}: UseDshHostStatusOptions) {
  const [doctor, setDoctor] = useState<CodexDoctorResult | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await runDshDoctor(dshBin);
      setDoctor(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [dshBin, enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    void refresh();
  }, [enabled, host, port, refresh]);

  const startHost = useCallback(async () => {
    if (!enabled) {
      return;
    }
    setStarting(true);
    setError(null);
    try {
      await ensureDshHost();
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!/cancelled/i.test(message)) {
        setError(message);
      }
    } finally {
      setStarting(false);
    }
  }, [enabled, refresh]);

  const cancelStart = useCallback(async () => {
    if (!enabled) {
      return;
    }
    try {
      await cancelDshHost();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
      await refresh();
    }
  }, [enabled, refresh]);

  const view: DshHostViewModel = useMemo(
    () =>
      mapDshDoctorToHostView({
        doctor,
        loading: loading && !starting,
        host,
        port,
      }),
    [doctor, host, loading, port, starting],
  );

  return {
    view,
    loading,
    starting,
    error,
    refresh,
    startHost,
    cancelStart,
  };
}
