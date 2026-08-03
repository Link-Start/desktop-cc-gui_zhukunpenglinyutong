# Proposal: add-skills-hub-management

> 追溯性提案（retrospective）：实现已随 `b1d94a930`（feat: skills）与 `c75922dec`（perf(skills)）于 2026-07-25 合入 main。本提案补齐 OpenSpec 跟踪事实，不改变已交付行为。

## Why

Settings 里的 `SkillsSection`（约 1289 行）是早期自建的 skills 管理面，维护成本高且能力有限；而 upstream TokenTracker 已有一套成熟的 skills-manager 页面（My Skills / 发现 / 安装 / 更新 / 目标引擎配置）。同时在 `add-tokentracker-usage-dashboard` 已把 TokenTracker dashboard vendor 进仓库的前提下，skills 管理复用同一 vendored 闭包与后端模式是更低熵的路径。

此外，大量本地 skill 库（数百行）下 My Skills 列表一次性挂载全部行导致滚动卡顿，批量操作栏随滚动丢失，需要虚拟化与 sticky 修正。

## What Changes

- 新增 Rust 内置 skills 后端 `src-tauri/src/skills_hub.rs`（约 3000 行，移植自 upstream skills-manager）：注册 `skills_hub_query` / `skills_hub_mutate` 两个 Tauri command，响应/错误形状与 upstream HTTP endpoint 保持 1:1；skills 模块完全自包含，不依赖 tokentracker-cli。
- vendor upstream skills 页面到 `src/features/extensions/tokentracker-dashboard/`：`pages/SkillsPage.jsx`、`pages/SkillDetailPanel.jsx`、`lib/skills-api.ts`（transport 在 Tauri runtime 下走 `invoke("skills_hub_query"/"skills_hub_mutate")`，浏览器 dev preview 回退 `/tt-dev` proxy）、`components/LocalOnlyNotice.jsx`、`ui/components/`（ConfirmModal / DismissibleHint / Input / Toast）、ProviderIcon 与 brand logos（claude-code / codex / gemini / opencode / antigravity）。
- Extensions 新增 Skills section：`SkillsDashboardSection.tsx` + `TokenTrackerSkillsView.tsx` + `TokenTrackerServerGate.tsx` + `hooks/useTokenTrackerViewBridge.ts`；vendored 页面（含 motion / @base-ui 依赖）隔离在 `React.lazy` 异步 chunk，不进 startup bundle；只做 locale/theme 桥接，无 CLI 安装门控。
- 下线 Settings 的旧 skills 管理面：删除 `src/features/settings/components/SkillsSection.tsx`（约 1289 行）及其测试，Settings 仅保留 curated skills 管理（`CuratedSection`）；清理各 locale `settings` namespace 中的旧 skills 文案。
- 大列表性能：`SkillsPage.jsx` 的 My Skills 在超过阈值（80 行）后按扩展滚动容器计算可见区间做 row windowing（固定行高 88px、overscan 8）；批量操作栏 sticky 于扩展 tab 行之下，bulk remove 使用显式 destructive 样式；`extensions.css` 增补共享 sticky offset。

## Capabilities

### New Capabilities

- `skills-hub-management`: Extensions-Skills 的 skills 管理契约——内置 Rust skills_hub 后端（query/mutate command 与 upstream HTTP 语义对齐）、vendored skills 页面（My Skills / 发现 / 安装 / 更新 / 目标引擎）、Tauri transport 适配、locale/theme 桥接与懒加载隔离、大列表 windowing 与 sticky 批量操作。

### Modified Capabilities

- `extensions-management-surface`: Skills tab 渲染真实 skills dashboard section（不再是占位/旧实现）；共享 sticky offset CSS 约定。
- `curated-skill-bundles`: Settings 的 Skills 区域收敛为仅 curated skills 管理；通用 skills 管理迁移至 Extensions。

## Impact

- Backend: `src-tauri/src/skills_hub.rs`（新增）、`src-tauri/src/command_registry.rs`（注册 2 个 command）、`src-tauri/src/lib.rs`。
- Frontend: `src/features/extensions/tokentracker-dashboard/pages/SkillsPage.jsx`、`SkillDetailPanel.jsx`、`lib/skills-api.ts`、`components/LocalOnlyNotice.jsx`、`ui/components/*`、`ui/dashboard/components/ProviderIcon.jsx`、`preview/main.tsx`、`assets/brand-logos/*`；`src/features/extensions/components/SkillsDashboardSection.tsx`、`TokenTrackerSkillsView.tsx`、`TokenTrackerServerGate.tsx`、`hooks/useTokenTrackerViewBridge.ts`、`components/tokentracker-dashboard-modules.d.ts`；`src/styles/extensions.css`。
- Removed: `src/features/settings/components/SkillsSection.tsx` + 测试；10 个 locale 的 `settings` namespace 旧 skills 文案。
- Tests: `SkillsPage.test.tsx`、`SkillsDashboardSection.test.tsx`、`ExtensionsView.test.tsx`、`SettingsView.test.tsx`、`extensions-layout.test.ts`。
- Governance: `large-file-new-file-baseline` 更新（vendored 大文件豁免）。

## 验收标准

- 拓展-Skills tab 渲染 vendored skills dashboard：My Skills（已安装列表 / 目标引擎 chip / 批量选择 / 卸载 / 恢复）、发现（popular / skillssh / 搜索）、安装 / 导入本地 skill、更新检查、skill 详情面板（SkillDetailPanel）。
- skills 数据全部来自内置 `skills_hub_query` / `skills_hub_mutate` command，无需安装 tokentracker-cli；浏览器 dev preview 可经 `/tt-dev` proxy 回退。
- vendored skills 页面与其依赖（motion / @base-ui）隔离在异步 chunk，startup bundle 不受影响。
- 本地 skill 库超过虚拟化阈值时 My Skills 只渲染可见窗口行，滚动流畅；批量操作栏 sticky 可达，bulk remove 为 destructive 样式。
- Settings 中旧 SkillsSection 不再出现，仅保留 curated skills 管理；相关 locale 文案已清理。
- focused Vitest（SkillsPage / SkillsDashboardSection / ExtensionsView / SettingsView / extensions-layout）、lint、typecheck、check:large-files 通过；OpenSpec strict validation 通过。
