import { useMemo } from "react";
import type { AppMode } from "../../types";

/**
 * S4 PR-E：按 appMode 的 feature flags（纯派生，无 UI）。
 * 视图层仍由 showKanban/showExtensions 等条件 JSX 控制；
 * 本 selector 给 Git/Kanban 等数据路径统一「是否在表面模式」判定。
 * 独立成纯模块，避免 domain assembly 经 useModeDomainHosts 拖入
 * kanban store 依赖链。
 */
export function resolveAppModeSurfaceFlags(appMode: AppMode) {
  const showKanban = appMode === "kanban";
  const showGitHistory = appMode === "gitHistory";
  const showExtensions = appMode === "extensions";
  const isChatSurface = appMode === "chat";
  /** chat / gitHistory 才需要右栏 Git active 轮询与 preload */
  const isGitSurfaceMode = appMode === "chat" || appMode === "gitHistory";
  return {
    appMode,
    showKanban,
    showGitHistory,
    showExtensions,
    isChatSurface,
    isGitSurfaceMode,
  };
}

export function useAppModeSurfaceFlags(appMode: AppMode) {
  return useMemo(() => resolveAppModeSurfaceFlags(appMode), [appMode]);
}
