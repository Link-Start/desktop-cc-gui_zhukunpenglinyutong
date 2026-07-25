import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";

import { useTokenTrackerViewBridge } from "../hooks/useTokenTrackerViewBridge";

// 整个 vendored skills 页面（含 motion / @base-ui 依赖）隔离在异步 chunk。
const LazyTokenTrackerSkills = lazy(() => import("./TokenTrackerSkillsView"));

function SkillsStatus({ label }: { label: string }) {
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

/**
 * 拓展-Skills section。skills 后端已内置（src-tauri/src/skills_hub.rs，
 * 移植自 upstream skills-manager），不依赖 tokentracker-cli，因此这里
 * 没有 usage 那样的 CLI 安装门控，只做 locale/theme 桥接 + 懒加载。
 */
export function SkillsDashboardSection() {
  const { t } = useTranslation();
  const { remountKey } = useTokenTrackerViewBridge();

  return (
    <div className="extensions-usage-section">
      <div key={remountKey} className="extensions-skills-dashboard">
        <Suspense
          fallback={<SkillsStatus label={t("common.loading")} />}
        >
          <LazyTokenTrackerSkills />
        </Suspense>
      </div>
    </div>
  );
}
