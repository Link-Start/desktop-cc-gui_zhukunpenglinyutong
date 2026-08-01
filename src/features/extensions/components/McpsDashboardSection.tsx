import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";

import type { WorkspaceInfo } from "../../../types";

import { useTokenTrackerViewBridge } from "../hooks/useTokenTrackerViewBridge";

// 整个 MCP 页面（含 motion / @base-ui 依赖）隔离在异步 chunk。
const LazyTokenTrackerMcps = lazy(() => import("./TokenTrackerMcpsView"));

function McpsStatus({ label }: { label: string }) {
  return (
    <div className="extensions-usage-status" role="status">
      <span
        className="codicon codicon-loading codicon-modifier-spin"
        aria-hidden
      />
      <p>{label}</p>
    </div>
  );
}

type McpsDashboardSectionProps = {
  activeWorkspace: WorkspaceInfo | null;
};

/**
 * 拓展-Mcps section。与 SkillsDashboardSection 同一模式：locale/theme 桥接
 * （remountKey 强制重挂）+ 懒加载。数据全部来自主 app Tauri services，
 * 在 McpsPage 内加载。
 */
export function McpsDashboardSection({ activeWorkspace }: McpsDashboardSectionProps) {
  const { t } = useTranslation();
  const { remountKey } = useTokenTrackerViewBridge();

  return (
    <div className="extensions-usage-section">
      <div key={remountKey} className="extensions-mcps-dashboard">
        <Suspense fallback={<McpsStatus label={t("common.loading")} />}>
          <LazyTokenTrackerMcps activeWorkspace={activeWorkspace} />
        </Suspense>
      </div>
    </div>
  );
}
