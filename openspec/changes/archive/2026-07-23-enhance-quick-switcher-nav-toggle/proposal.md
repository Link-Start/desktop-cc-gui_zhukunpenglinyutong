## Why

Quick Switcher 快速导航当前是「单向打开」语义：① 已打开的模块再次点击入口仍然是「打开」，无法通过同一入口关闭，用户必须去找模块自己的关闭按钮；② 意图画布/项目地图/便签/项目记忆等入口在无 active workspace 时静默打开到空默认页（或 terminal 静默 no-op），用户得不到任何反馈；③ 意图画布的无 workspace 提示用的是 `window.alert` 阻塞弹窗，与 Spec Hub 已有的 toast 示范不一致。

用户明确要求：相同入口再次点击应「回切」（开→关→开），无效打开应给出提示而非落入默认页。

## 目标与边界

- 支持回切的入口：`history` / `kanban` / `settings` / `intentCanvas` / `projectMap` / `files` / `git` / `notes` / `memory`；`globalSearch` 保持 open-only（打开 Quick Switcher MUST 先关闭 Search Palette，两面板互斥，回切与高亮分支运行时不可达，代码分支保留为契约性守护）；`terminal` 已是天然 toggle 保持不变。
- 导航行增加「当前已打开」高亮态（is-active），让回切目标可感知。
- 无效打开提示：`intentCanvas` / `projectMap` / `notes` / `memory` / `terminal` 在无 active workspace 时展示 info 级 toast 且 MUST NOT 打开模块；`intentCanvas` 的 `window.alert` 迁移为 toast。
- 全部状态判定与 toggle 逻辑收敛在 wrapper 层（`useAppShellLayoutNodesSection` 的 `handleQuickSwitcherNavigate`），复用既有 canonical close actions，不新增后端命令。

## 非目标

- `spec`（Spec Hub 独立窗口）保持 open-or-focus，不做 toggle（关闭独立窗口体感差，且用户可能正在查看该窗口）。
- `chat`（对话）不做 toggle——它是默认落点，无「关闭」语义。
- `terminal` 已有 toggle 语义，仅补无 workspace 提示，不改变其开/关行为。
- 不改变各模块自身的打开行为与页面结构；不提交 git commit。

## What Changes

- wrapper 的 `handleQuickSwitcherNavigate` 扩展为「状态感知路由」：对每个支持回切的入口，先判定当前激活状态（`centerMode` / `appMode` / `filePanelMode + rightPanelCollapsed` / `settingsOpen` / `isSearchPaletteOpen`），已打开则执行对应 close（`setCenterMode("chat")` / `setAppMode("chat")` / `collapseRightPanel()` / `closeSettings()` / `handleToggleSearchPalette` / `handleOpenGitHistoryPanel`），未打开走既有 open action。
- `history` 从 base 的 `setAppMode("gitHistory")` 改接现成 toggle `handleOpenGitHistoryPanel`；`globalSearch` 分支接现成 `handleToggleSearchPalette`，但因两面板互斥仅作契约性守护（open-only，见「目标与边界」）；`files` / `git` / `kanban` / `settings` 的拦截从 base 上移到 wrapper（base 保留兜底）。
- `notes` 关闭语义：`collapseRightPanel()` + `setCenterMode("chat")`（不留残留态）；其余面板类入口关闭 = `collapseRightPanel()`。
- compact layout 判定口径：面板类入口以 `activeTab === "git" && filePanelMode === X` 判定激活（compact 下 expand/collapse 是 no-op）。
- 无效打开提示统一 `pushErrorToast({ variant: "info", ... })`，文案走新增 i18n key（含模块名插值）；`intentCanvas` 的 `alertError`（window.alert）替换为同款 toast。
- `NAVIGATION_ITEMS` 行渲染支持 `is-active` 视觉态（数据源为 wrapper 计算的激活 id 集合，经既有 prop 中继传入组件）。

## 技术方案对比

### 方案 A：状态判定收敛 wrapper 层（采用）

- wrapper 已可读全部所需状态（centerMode/appMode/filePanelMode/rightPanelCollapsed/isCompact/activeTab/settingsOpen 需补充解构）。
- 优点：单点路由、base 保持兜底、不扩大 base boundary；缺点：wrapper 函数变长，需配行为级测试。

### 方案 B：状态下传 base boundary 分散实现（不采用）

- 优点：各 case 就近处理；缺点：boundary 膨胀、判定口径分散、与 wrapper 拦截职责重叠。

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `quick-context-switcher`: 快速导航回切语义、当前模块高亮与无效打开提示。

## 验收标准

- 打开任一支持回切的模块后再次点击相同入口：模块关闭（面板类收起右侧面板、center 类回到 chat、kanban/history 回到 chat、settings 关闭）；第三次点击重新打开。`globalSearch` 保持 open-only：任何时候点击仅打开 Search Palette。
- 当前已打开的模块对应导航行呈现可区分的高亮态，关闭后高亮消失。
- 无 active workspace 时点击意图画布/项目地图/便签/项目记忆/终端：展示 info 级 toast 提示先选择工作区，模块 MUST NOT 打开、MUST NOT 落入空默认页；意图画布不再出现 `window.alert`。
- Spec Hub 重复点击仍为 focus 已开窗口；terminal 开/关行为不变。
- compact layout 下面板类入口的回切判定与 desktop 行为一致。
- 相关 focused Vitest、targeted lint/typecheck 与 `openspec validate enhance-quick-switcher-nav-toggle --strict --no-interactive` 通过。

## Impact

- Frontend：`src/app-shell-parts/useAppShellLayoutNodesSection.tsx`（wrapper 路由）、`src/app-shell-parts/useAppShellQuickSwitcherSection.ts`（base 兜底与 terminal 提示）、`src/features/quick-switcher/**`（is-active 行态与 props）、`src/app-shell-parts/useAppShellSearchAndComposerSection.ts` / `renderAppShell.tsx`（active ids 中继）、`src/styles/quick-switcher.css`、i18n locales。
- Storage：无变更。Dependencies：无新增。
