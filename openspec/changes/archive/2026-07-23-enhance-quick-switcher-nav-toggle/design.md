## Context

侦察已确认（证据行号见实施时注释）：

- wrapper 层（`useAppShellLayoutNodesSection.tsx`）已可读 `centerMode`（:230）、`filePanelMode`（:291）、`appMode`（:203）、`rightPanelCollapsed`（:500）、`terminalOpen`（:561）、`isCompact` / `activeTab`；wrapper 拦截器在 :1440-1476。
- 现成 toggle：`handleOpenGitHistoryPanel`（:1427-1432，`current === "gitHistory" ? "chat" : "gitHistory"`）、`handleToggleSearchPalette`（`useAppShellSearchAndComposerSection.ts:456-462`）；terminal 的 `handleToggleTerminalPanel` 已是 toggle。
- canonical close：`collapseRightPanel`（useSidebarToggles）、`closeSettings`（useSettingsModalState:54）、`setCenterMode("chat")`（先例 handleExitDiff :1423-1426）、`setAppMode("chat")`（先例 KanbanModeToggle）。
- toast：`src/services/toasts.ts` 的 `pushErrorToast` 为纯函数，支持 `variant: "info"`，全局 ErrorToasts 已挂载，wiring 层可直接 import 调用；Spec Hub 的 selectWorkspaceFirst 提示是既有示范。
- 现状问题：`projectMap` / `notes` / `memory` 无 workspace 守卫（静默进空默认页）；`terminal` 无 workspace 时静默 no-op（usePanelVisibility:27）；`intentCanvas` 用 `alertError`（window.alert）。

## Goals / Non-Goals

见 proposal。实现约束：不改变各模块 open action 本身；toggle 判定为纯函数逻辑，无新增订阅/定时器。

## Decisions

### D1：回切状态判定口径（wrapper 层统一）

| 入口 | 激活判定（desktop） | 激活判定（compact） | 关闭动作 |
|---|---|---|---|
| files / git / memory | `filePanelMode === X && !rightPanelCollapsed` | `activeTab === "git" && filePanelMode === X` | `collapseRightPanel()` |
| notes | `filePanelMode === "notes" && !rightPanelCollapsed` | `activeTab === "git" && filePanelMode === "notes"` | `collapseRightPanel()` + `setCenterMode("chat")` |
| kanban | `appMode === "kanban"` | 同左 | `setAppMode("chat")` |
| history | `appMode === "gitHistory"` | 同左 | `handleOpenGitHistoryPanel()`（现成 toggle） |
| settings | `settingsOpen` | 同左 | `closeSettings()` |
| intentCanvas / projectMap | `centerMode === X` | 同左 | `setCenterMode("chat")` |

- `globalSearch` 不在上表：保持 open-only。打开 Quick Switcher MUST 先关闭 Search Palette（两面板互斥），其激活判定（`isSearchPaletteOpen`）与回切分支（`handleToggleSearchPalette`）为契约性守护，运行时不可达（见文末「实现说明（收尾补记）」）。
- `files` / `git` / `kanban` / `settings` 的拦截从 base 上移到 wrapper；base 的对应 case 保留为兜底（与现有 globalSearch 等模式一致）。
- 激活 id 集合由 wrapper 以 `useMemo` 计算为 `quickSwitcherActiveNavigationIds: QuickSwitcherNavigationId[]`，经既有中继链（SearchAndComposerSection → renderAppShell）传给 `<QuickSwitcher activeNavigationIds>`，组件据此渲染 `is-active` 行态。集合中保留 `globalSearch` 的契约性判定，但因两面板互斥运行时恒不激活，导航行不会因此呈现 is-active。

### D2：无效打开提示

- 触发条件：`!activeWorkspace`（terminal 用 `!activeWorkspaceId`），适用于 `intentCanvas` / `projectMap` / `notes` / `memory`（wrapper 拦截分支内判定）与 `terminal`（base handler 内判定，boundary 已有 activeWorkspaceId）。
- 动作：`pushErrorToast({ variant: "info", title: 模块名, message: t("quickSwitcher.hints.selectWorkspaceFirst") })`，随后 `closeQuickSwitcher()`，MUST NOT 执行 open。
- `intentCanvas` 原 `alertError` 路径替换为同款 toast（保持 `intentCanvas.errors.noWorkspace` 或并入新 key，以既有 key 复用优先）。
- 新增 i18n key：`quickSwitcher.hints.selectWorkspaceFirst`（zh: `请先选择工作区再打开该功能` / en: `Select a workspace first to open this`），10 locale 由集成 worker 合并。

### D3：is-active 行态

- 组件 props 新增 `activeNavigationIds?: QuickSwitcherNavigationId[]`（可选，默认空数组，向后兼容既有 mocks）。
- 行 class 追加 `is-active`（复用 Sidebar 的 is-active 视觉语言），样式写在 `quick-switcher.css`，light/dark 均可用，不新增 CSS 变量。
- keyboard model 不变（is-active 纯展示）。

### D4：测试策略

- wrapper 行为级测试（renderHook + 最小 input 构造，仓库已有先例）：逐入口「未开 → open action」「已开 → close action」「无 workspace → toast + 不打开」三分支；terminal 提示在 base 测试。
- 组件测试：is-active 渲染、activeNavigationIds 缺省兼容。
- 既有 wrapper 字符串断言保留，新增行为测试不替代它们。

## Risks / Trade-offs

- **wrapper 体积增长**：13 个入口的判定集中一处，需保持判定小函数化（每入口一个 pure predicate）。
- **compact 下 Quick Switcher 快捷键禁用**：compact 判定分支主要服务未来与其他入口路径，按现状实现但不夸大测试范围。
- **settings/globalSearch 的「关闭」与 Quick Switcher 自身关闭的关系**：Quick Switcher 激活任何入口后自身都会关闭；toggle 语义作用于「目标模块」状态，用户再次打开 ⌘E 点击同一入口即回切——行为测试必须覆盖「Quick Switcher 关闭后重开再点」的状态判定（状态在 app-shell，跨开关持久）。
- **与并行 fix 批次的文件冲突**：本 change 实现安排在 review 修复批次完成之后串行进行，避免 wrapper/QuickSwitcher.tsx 同时被两批修改。

## Migration Plan

无数据 migration、无 feature flag；回滚 = `git checkout --` 本变更文件。

## Open Questions

无（notes 关闭残留态与 spec 不 toggle 两处产品决策已在 proposal 拍板）。

### 实现说明（收尾补记）

- **globalSearch 高亮/回切运行时不可达**：D1 为 globalSearch 实现了激活判定（`isSearchPaletteOpen`）与回切（`handleToggleSearchPalette`）作为契约性实现；但 `useAppShellQuickSwitcherSection` 在打开/toggle QuickSwitcher 时强制 `setIsSearchPaletteOpen(false)`（两面板互斥），因此 QuickSwitcher 打开期间 `isSearchPaletteOpen` 恒为 false，is-active 高亮与回切分支在运行时均不可达；wrapper 分支与测试保留用于契约守护。
- **terminal 不在 is-active 集合**：terminal 无持久「打开」状态可判定（终端面板开闭不进入 layout nodes 状态），故 `quickSwitcherActiveNavigationIds` 不含 terminal，导航行永不渲染 is-active 态；base handler 仅保留 `!activeWorkspaceId` 守卫 + info toast。
