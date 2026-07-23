## 1. Wrapper 状态感知路由

- [x] 1.1 [P0, depends: none] 在 `useAppShellLayoutNodesSection.tsx` 按 design.md D1 实现逐入口激活判定（纯函数 predicates）与回切路由：files/git/notes/memory → collapseRightPanel（notes 连带 setCenterMode("chat")）、kanban → setAppMode("chat")、history → handleOpenGitHistoryPanel、settings → closeSettings、intentCanvas/projectMap → setCenterMode("chat")；globalSearch 保持 open-only（两面板互斥导致回切/高亮运行时不可达，`handleToggleSearchPalette` 分支保留为契约性守护）；files/git/kanban/settings 拦截从 base 上移，base 保留兜底。
- [x] 1.2 [P0, depends: none] 按 design.md D2 实现无效打开提示：wrapper 的 intentCanvas/projectMap/notes/memory 分支加 `!activeWorkspace` 守卫 + info toast + 不打开；intentCanvas 的 alertError 迁为 toast；base 的 terminal case 加 `!activeWorkspaceId` 守卫 + info toast。
- [x] 1.3 [P0, depends: 1.1] 计算 `quickSwitcherActiveNavigationIds` 并补中继链（SearchAndComposerSection → renderAppShell）传入 `<QuickSwitcher activeNavigationIds>`。
  - 备注（收尾核实）：中继路径有偏差——实际为 `useAppShellLayoutNodesSection` → `renderAppShell` 直接传入，未经过 `SearchAndComposerSection`；功能等价（`renderAppShell` 拿到的引用相同），wiring tests 已按实际链路守护。

## 2. 组件层

- [x] 2.1 [P0, depends: none] `QuickSwitcher.tsx` props 新增可选 `activeNavigationIds`，导航行渲染 `is-active` 态；`quick-switcher.css` 增加 is-active 样式（复用既有视觉语言、不新增 CSS 变量）。

## 3. 测试与验证

- [x] 3.1 [P0, depends: 1.1-2.1] wrapper 行为级测试（逐入口开/关/提示三分支）+ base terminal 提示测试 + 组件 is-active 测试；i18n 新 key 合并 10 locale 并验证 parity。
- [x] 3.2 [P0, depends: 3.1] 运行 quick-switcher / shell wiring / i18n 相关 focused Vitest、targeted ESLint、typecheck 与 `openspec validate enhance-quick-switcher-nav-toggle --strict --no-interactive`；diff 审计确认只含本 change 文件；**不提交 commit、不 archive**。
