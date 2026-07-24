# Vendored Frontend 约定（tokentracker-dashboard）

`src/features/extensions/tokentracker-dashboard/` 是从上游 TokenTracker（MIT）vendor 的 dashboard 前端闭包，服务「拓展-使用统计」。本页固化其维护约定。

## 目录性质

- **vendored, not authored**：除登记在案的裁剪/适配点外，文件与上游 `TokenTracker/dashboard/src` 逐字节一致。禁止重排版、重命名、拆分行数（大文件走 `check:large-files:new-file-baseline` 豁免，当前豁免：`ActivityHeatmap.jsx`、`use-trend-data.ts`、`ActivityHeatmap3D.jsx`）。
- `.jsx` 不在 lint 范围（lint 只查 `.ts/.tsx`）；vendored `.ts` 必须通过 lint/typecheck；vendored 文件里既有的 react-hooks warning 不清零。
- 同步上游时先 diff 裁剪点清单（见 OpenSpec change `add-tokentracker-usage-dashboard`），再逐文件对齐。

## 裁剪边界（不vendor / 已删除）

cloud（InsForge/leaderboard/account 聚合）、auth gate、router、dnd 排序、mock-data（10 行 stub）、limits/achievements/分享/install 卡片、ContextBreakdownPanel、设备卡片。`lib/api.ts` 仅保留 10 个 local slug + `triggerLocalSync`。

## 数据通道（不可改回 fetch）

- 前端一律经 `lib/tt-transport.ts` → `invoke("tt_proxy", { method, path, headers, body })`；Rust 侧 allowlist 仅 `/functions/tokentracker-*` 与 `/api/local-auth`。
- 浏览器 dev 预览走 `/tt-dev` vite proxy（`vite.config.ts`），预览入口 `tt-dashboard-preview.html` + `preview/main.tsx`；`useTokenTrackerServer` 在非 Tauri 环境跳过 detect/ensure 直接 ready。

## CLI 安装边界

- 未安装 CLI 时，`UsageDashboardSection` MAY 提供一键安装，但只能调用 `tt_install_cli` 这类固定 backend command；frontend 禁止拼接或传入任意 shell command。
- 安装期间必须进入显式 `installing` 状态；成功后重走 `detect -> ensure server`，失败进入可恢复 error 状态。

## 样式（Tailwind v4 关键坑）

- **`--color-oai-*` token 必须留在 `globals.css` 的 `@theme`**：v4 只为 utilities-emitting compilation 可见的 token 生成类；放别处（如不 import tailwind 的 `tokentracker-dashboard.css`）会导致颜色 utility（含 `dark:` 变体）静默不生成——2026-07-24 暗色失效即此根因。
- `--radius-*` / `--font-mono` 与上游 `:root` 变量一律 scope 在 `.tt-dashboard` / `.tt-dashboard.dark`，**禁止**进 `@theme`（会改 app 全局圆角/字体）。
- 其 ThemeProvider 把 `.dark` 写到 `.tt-dashboard` wrapper（不是 `<html>`）；`globals.css` 的 `@custom-variant dark` 已扩展 `.dark` class 匹配。

## 性能边界

- vendored tree 只能经 `TokenTrackerDashboardView.tsx`（`React.lazy`）异步加载，禁止任何静态 import 把它拉进 startup chunk。
- 数据 state 留在 extensions 子树，禁挂 app-shell 根链；vendored auto-refresh 为 30s 自适应，不得再加秒级轮询。
