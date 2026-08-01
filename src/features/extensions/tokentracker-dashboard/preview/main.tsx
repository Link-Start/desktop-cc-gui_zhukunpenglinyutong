/**
 * vendored TokenTracker dashboard 的浏览器独立预览入口（仅 vite dev 使用）。
 *
 * 用途：脱离 Tauri 直接在浏览器里迭代 `tokentracker-dashboard/` 的前端代码，
 * 数据经 vite dev proxy `/tt-dev` 转发到本机 `tokentracker serve`（127.0.0.1:7680）。
 * 用法：`npm run dev` 后访问 http://localhost:1420/tt-dashboard-preview.html
 *   - 默认渲染用量仪表盘；`?view=skills` 渲染 Skills 管理页。
 */
import "../../../../styles/globals.css";
import "../../../../styles/tokentracker-dashboard.css";

import { createRoot } from "react-dom/client";
import { lazy, Suspense } from "react";

import TokenTrackerDashboardView from "../../components/TokenTrackerDashboardView";

// Skills 预览按需加载（与宿主侧保持同一个异步 chunk 边界）。
const TokenTrackerSkillsView = lazy(
  () => import("../../components/TokenTrackerSkillsView"),
);

const container = document.getElementById("root");
if (container) {
  const view = new URLSearchParams(window.location.search).get("view");
  createRoot(container).render(
    view === "skills" ? (
      <Suspense fallback={null}>
        <TokenTrackerSkillsView />
      </Suspense>
    ) : (
      <TokenTrackerDashboardView />
    ),
  );
}
