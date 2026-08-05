import { useCallback, useEffect, useState } from "react";
import { getClientStoreSync, writeClientStoreValue } from "../../../services/clientStorage";

type UseSidebarTogglesOptions = {
  isCompact: boolean;
};

function readStoredBool(key: string, defaultValue = false) {
  const stored = getClientStoreSync<boolean>("layout", key);
  if (stored === undefined) {
    return defaultValue;
  }
  return stored;
}

/** One-shot: open right panel for clients that inherited collapsed-by-default. */
const RIGHT_PANEL_OPEN_MIGRATION_KEY = "rightPanelChromeOpenV1";

function readRightPanelCollapsed(): boolean {
  const migrated = getClientStoreSync<boolean>(
    "layout",
    RIGHT_PANEL_OPEN_MIGRATION_KEY,
  );
  if (migrated !== true) {
    writeClientStoreValue("layout", RIGHT_PANEL_OPEN_MIGRATION_KEY, true, {
      immediate: true,
    });
    writeClientStoreValue("layout", "rightPanelCollapsed", false, {
      immediate: true,
    });
    return false;
  }
  return readStoredBool("rightPanelCollapsed", false);
}

export function useSidebarToggles({ isCompact }: UseSidebarTogglesOptions) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Default expanded. Migration opens once for clients that shipped with
  // collapsed-by-default (true) and never saw the right panel / tools.
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(
    readRightPanelCollapsed,
  );

  useEffect(() => {
    writeClientStoreValue("layout", "sidebarCollapsed", sidebarCollapsed);
  }, [sidebarCollapsed]);

  useEffect(() => {
    writeClientStoreValue("layout", "rightPanelCollapsed", rightPanelCollapsed);
  }, [rightPanelCollapsed]);

  const collapseSidebar = useCallback(() => {
    if (!isCompact) {
      setSidebarCollapsed((current) => (current ? current : true));
    }
  }, [isCompact]);

  const expandSidebar = useCallback(() => {
    if (!isCompact) {
      setSidebarCollapsed((current) => (current ? false : current));
    }
  }, [isCompact]);

  const collapseRightPanel = useCallback(() => {
    if (!isCompact) {
      setRightPanelCollapsed((current) => (current ? current : true));
    }
  }, [isCompact]);

  const expandRightPanel = useCallback(() => {
    if (!isCompact) {
      setRightPanelCollapsed((current) => (current ? false : current));
    }
  }, [isCompact]);

  return {
    sidebarCollapsed,
    rightPanelCollapsed,
    collapseSidebar,
    expandSidebar,
    collapseRightPanel,
    expandRightPanel,
  };
}
