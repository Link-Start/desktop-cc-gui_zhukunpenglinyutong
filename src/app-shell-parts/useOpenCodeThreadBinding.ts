import { useCallback, useEffect, useMemo } from "react";
import type { useOpenCodeSelection } from "./useOpenCodeSelection";

type OpenCodeSelectionSection = ReturnType<typeof useOpenCodeSelection>;

type OpenCodeThreadBindingParams = {
  activeThreadId: string | null;
  resolveOpenCodeAgentForThread: OpenCodeSelectionSection["resolveOpenCodeAgentForThread"];
  resolveOpenCodeVariantForThread: OpenCodeSelectionSection["resolveOpenCodeVariantForThread"];
  selectOpenCodeAgentForThread: OpenCodeSelectionSection["selectOpenCodeAgentForThread"];
  selectOpenCodeVariantForThread: OpenCodeSelectionSection["selectOpenCodeVariantForThread"];
  syncActiveOpenCodeThread: OpenCodeSelectionSection["syncActiveOpenCodeThread"];
};

export function useOpenCodeThreadBinding({
  activeThreadId,
  resolveOpenCodeAgentForThread,
  resolveOpenCodeVariantForThread,
  selectOpenCodeAgentForThread,
  selectOpenCodeVariantForThread,
  syncActiveOpenCodeThread,
}: OpenCodeThreadBindingParams) {
  useEffect(() => {
    syncActiveOpenCodeThread(activeThreadId);
  }, [activeThreadId, syncActiveOpenCodeThread]);

  const selectedOpenCodeAgent = useMemo(
    () => resolveOpenCodeAgentForThread(activeThreadId),
    [activeThreadId, resolveOpenCodeAgentForThread],
  );

  const selectedOpenCodeVariant = useMemo(
    () => resolveOpenCodeVariantForThread(activeThreadId),
    [activeThreadId, resolveOpenCodeVariantForThread],
  );

  const handleSelectOpenCodeAgent = useCallback(
    (agentId: string | null) => {
      selectOpenCodeAgentForThread(activeThreadId, agentId);
    },
    [activeThreadId, selectOpenCodeAgentForThread],
  );

  const handleSelectOpenCodeVariant = useCallback(
    (variant: string | null) => {
      selectOpenCodeVariantForThread(activeThreadId, variant);
    },
    [activeThreadId, selectOpenCodeVariantForThread],
  );

  return {
    handleSelectOpenCodeAgent,
    handleSelectOpenCodeVariant,
    selectedOpenCodeAgent,
    selectedOpenCodeVariant,
  };
}
