import { useKanbanStore } from "../../features/kanban/hooks/useKanbanStore";
import type { AppMode } from "../../types";
import type { WorkspaceInfo } from "../../types";
import { useAppModeSurfaceFlags } from "./appModeSurfaceFlags";

export {
  resolveAppModeSurfaceFlags,
  useAppModeSurfaceFlags,
} from "./appModeSurfaceFlags";

/**
 * Kanban 数据 host。
 *
 * 注意：scheduled/autoStart 任务在非看板视图仍须执行（见 useAppShellKanbanExecutionSection），
 * 因此 store 保持常驻；本 host 只统一出口并附带 surface flag，供后续按任务态做更细门控。
 */
export function useKanbanDomainHost(input: {
  workspaces: WorkspaceInfo[];
  appMode: AppMode;
}) {
  const surface = useAppModeSurfaceFlags(input.appMode);
  const store = useKanbanStore(input.workspaces);
  return {
    ...store,
    isKanbanSurfaceActive: surface.showKanban,
    isGitSurfaceMode: surface.isGitSurfaceMode,
    modeSurface: surface,
  };
}

export type KanbanDomainHost = ReturnType<typeof useKanbanDomainHost>;
