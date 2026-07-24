## Why

Extensions 视图的「使用统计」tab 目前是空态占位（"即将实现"）。需要落地一个真实可用的 token 用量统计 dashboard：复用开源项目 TokenTracker（`tokentracker-cli`，MIT）作为本地数据后端，并将其官方 dashboard 前端源码 vendor 进本仓库，使「拓展-使用统计」展示与其官方 UI 完全一致的内容（统计卡片、Top 模型、2D/3D 热力图、使用趋势、period 切换、按工具分布、每日细目/项目用量）。

## What Changes

- 新增 Rust 侧 TokenTracker 集成：检测 `tokentracker` CLI 是否全局安装、通过固定 `npm install -g tokentracker-cli` command 提供一键安装、探测/拉起其本地 server（`127.0.0.1`，默认 port 7680）、提供 generic HTTP proxy command（`tt_proxy`）供前端访问 `/functions/tokentracker-*` 与 `/api/local-auth`（其 server 不返回 CORS header，WebView 直连会被浏览器拦截，必须经 Rust 转发）。
- vendor TokenTracker dashboard 前端闭包到 `src/features/extensions/tokentracker-dashboard/`（pages / views / components / hooks / lib / content），裁剪掉 cloud（InsForge）、auth、router、dnd 排序、mock-data、limits、achievements、分享等非截图范围能力；api 层 transport 由同源 `fetch` 改为 Tauri `invoke("tt_proxy")`。
- Tailwind v4 适配：其 Tailwind v3 theme（oai 色阶、`--radius-*` 4/8/12/16、`font-mono`）与 styles.css 关键片段（`:root` 变量、`.oai-text-*`、`.oai-scrollbar`、`tt-*` keyframes、`.rdp-*`）以 **scoped 方式**（挂在 `.tt-dashboard` wrapper，不污染全局 theme token）移植；`globals.css` 的 `dark` custom-variant 扩展为同时识别 `.dark` class。
- ExtensionsView 的 usage tab 渲染新 section：状态机为 `checking → guide（未安装，提供一键安装 + 手动命令兜底）→ installing → starting → ready / error`；ready 后 React.lazy 加载 vendored dashboard（motion 等依赖隔离在异步 chunk，不进 startup bundle）。
- 新增 npm dependencies：`motion`、`@base-ui/react`、`react-day-picker`、`date-fns`（`clsx`/`tailwind-merge`/`lucide-react` 已存在）。不引入 three.js（其 3D 热力图为手写 SVG 投影）。
- 拉起 server 时设置 `TOKENTRACKER_NO_TELEMETRY=1` 关闭其匿名遥测；server 以 detached 进程常驻（与其官方 macOS/Windows 客户端行为一致）。

## Capabilities

### New Capabilities

- `tokentracker-usage-dashboard`: 拓展-使用统计的 TokenTracker 集成契约——CLI 检测与安装引导、server 生命周期、tt_proxy 数据通道、vendored dashboard 渲染与主题/locale 桥接。

### Modified Capabilities

- `extensions-management-surface`: usage tab 不再是空态 introduction panel，改为渲染 TokenTracker usage dashboard section（其余 tab 空态不变）。

## Impact

- Backend: `src-tauri/src/tokentracker.rs`（新增）、`src-tauri/src/command_registry.rs`（注册 5 个 command）。
- Frontend: `src/features/extensions/tokentracker-dashboard/**`（vendored，约 60 文件）、`src/features/extensions/components/UsageDashboardSection.tsx`、`ExtensionsView.tsx`、`src/services/tauri/tokentracker.ts`、`src/types/tokentracker.ts`、`src/styles/tokentracker-dashboard.css`（新增）+ `extensions.css`/`globals.css` 小改、10 个 locale 的 `extensions` namespace 增补、`public/brand-logos/`（11 个 svg）。
- Dependencies: `motion`、`@base-ui/react`、`react-day-picker`、`date-fns`。
- Gates: vendored 大文件（`ActivityHeatmap.jsx` 1028 行等 3 个）通过 `check:large-files:new-file-baseline` 基线豁免；`.jsx` 不在 lint 范围；vendored `.ts` 需通过 lint/typecheck。

## 验收标准

- 未安装 tokentracker-cli 时，usage tab 展示安装引导（一键安装 + 命令复制 + 打开 npm 页面 + 重新检测）；一键安装期间展示安装过程，安装后自动重新检测、启动 server 并渲染 dashboard；安装失败展示可重试 error。
- dashboard 渲染与 TokenTracker 官方 UI 一致：StatsPanel（7天/30天/平均/对话 + Top3 模型）、ActivityHeatmap（2D/3D）、TrendMonitor、UsageOverview（日/周/月/总计/自定义 + TOKEN 总数 + 费用 + 按工具百分比卡片）、DataDetails（每日细目/项目用量 + 项目钻取弹窗）。
- dashboard 数据来自真实 `tokentracker serve` 本地 server，经 `tt_proxy` 转发；`TOKENTRACKER_NO_TELEMETRY=1` 生效。
- vendored dashboard 的 Tailwind theme 不泄漏到 app 全局（`.tt-dashboard` scope）；其 `.dark` class 主题与 app 的 `data-theme` 机制互不干扰。
- startup bundle 不包含 motion/react-day-picker 等（React.lazy chunk）。
- focused Vitest、lint、typecheck、check:large-files、build 与 OpenSpec strict validation 通过；真实 server 下人工/截图 QA 通过。
