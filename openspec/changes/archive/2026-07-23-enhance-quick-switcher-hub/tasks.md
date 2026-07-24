## 1. Shell Wiring 层（Worker A）

- [x] 1.1 [P0, depends: none] 按 design.md D1 扩展 `QuickSwitcherShellBoundary`（`runningSessions`）并完成 `SessionRadarEntry[] → QuickSwitcherRunningSession[]` 映射透出；`app-shell.tsx:2345` 传参、中继链（`useAppShellSearchAndComposerSection.ts` → `renderAppShell.tsx`）同步接通。
- [x] 1.2 [P0, depends: none] 在 `useAppShellLayoutNodesSection.tsx` 的 `handleQuickSwitcherNavigate` wrapper 增加 `globalSearch` / `notes` / `memory` 三个拦截分支，接 `handleOpenSearchPalette` / `handleOpenNotes` / `handleOpenProjectMemory` 并 `closeQuickSwitcher()`。
- [x] 1.3 [P0, depends: 1.1, 1.2] 新增/更新 wiring tests：3 个新 id 触发正确 action 且面板关闭、running 映射正确、中继 mock 同步；运行 focused vitest。

## 2. 组件层（Worker B）

- [x] 2.1 [P0, depends: none] 按 design.md D1/D3 扩展 `types.ts`（3 个 nav id + `QuickSwitcherRunningSession`）、`QuickSwitcher.tsx` NAVIGATION_ITEMS（globalSearch 首位、notes/memory 在 settings 前）与语义 icon。
- [x] 2.2 [P0, depends: none] 按 design.md D2 实现「进行中」区：sessions pane 顶部固定 section、live pulse badge（`quick-switcher.css` 新类、`#57d18c` 视觉语言）、相对开始时间、行计入扁平化键盘模型、从下方最近会话去重、点击走 `onSelectSession`；空态不渲染。
- [x] 2.3 [P0, depends: 2.1, 2.2] 新增 component tests：running 区渲染/空态/去重/点击/键盘、新导航行 onNavigate id；运行 focused vitest。新 i18n key + zh/en 文案写入报告（禁止改 locales）。

## 3. 集成与验证（Worker C）

- [x] 3.1 [P0, depends: 1.1-2.3] 合并全部新 i18n key 到 10 个 locale（zh/zh-TW/en/ja/ko/fr/es/ru/pt-BR/hi），验证 key parity 与复数 placeholder 一致；回填 tasks.md 勾选。
- [x] 3.2 [P0, depends: 3.1] 运行 quick-switcher / 中继链 / i18n 相关 focused Vitest suites、 touched-file targeted ESLint、项目 typecheck 与 `openspec validate enhance-quick-switcher-hub --strict --no-interactive`；记录任何既有无关失败。
- [x] 3.3 [P0, depends: 3.2] 完成 diff 审计，确认只包含本 change 文件；保留 manual desktop visual QA 为用户最终验收项，**不提交 commit、不 archive**。

## 4. Review 修复

- [x] 4.1 `startedAt` nullable：`QuickSwitcherRunningSession.startedAt` 允许空值，渲染层做空值兜底。
- [x] 4.2 键盘 wrap-around / 空组剔除 / 跨 workspace 跳转测试：扁平化键盘模型到边界循环、无条目分组不参与导航、running 行点击跨 workspace 正确路由的 focused tests。
- [x] 4.3 wrapper 行为级测试：`useAppShellLayoutNodesSection` 三个新拦截分支（globalSearch/notes/memory）触发正确 action 且面板关闭的行为级守护。
- [x] 4.4 reduced-motion：live pulse badge 动画尊重 `prefers-reduced-motion`。
- [x] 4.5 spread 顺序契约测试：`SessionRadarEntry[] → QuickSwitcherRunningSession[]` 映射的字段 spread 顺序以后置显式字段为准，契约测试守护。
