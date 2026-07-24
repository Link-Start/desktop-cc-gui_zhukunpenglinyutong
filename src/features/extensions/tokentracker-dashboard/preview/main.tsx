/**
 * vendored TokenTracker dashboard 的浏览器独立预览入口（仅 vite dev 使用）。
 *
 * 用途：脱离 Tauri 直接在浏览器里迭代 `tokentracker-dashboard/` 的前端代码，
 * 数据经 vite dev proxy `/tt-dev` 转发到本机 `tokentracker serve`（127.0.0.1:7680）。
 * 用法：`npm run dev` 后访问 http://localhost:1420/tt-dashboard-preview.html
 */
import "../../../../styles/globals.css";
import "../../../../styles/tokentracker-dashboard.css";

import { createRoot } from "react-dom/client";

import TokenTrackerDashboardView from "../../components/TokenTrackerDashboardView";

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<TokenTrackerDashboardView />);
}
