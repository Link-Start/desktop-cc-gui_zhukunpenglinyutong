# remove-kanban-and-task-center

## Why

产品决策（2026-08-14，用户拍板）：**Kanban 看板模式与 Task Center 整体移除**，为 AppShell 根 composition 瘦身与性能治理让路。

事实依据（探查结论）：

- Kanban 全链约 60 个生产文件：`src/features/kanban/` 35 文件 ~4500 行、app-shell 17 个 domain keys 横跨 4 domain、`useAppShellKanbanExecutionSection.ts`（1483 行）+ `useAppShellKanbanComposerSection.ts`（558 行）、`src/styles/kanban.css`（2093 行）、10 locale `kanban.ts`（~1948 行）。
- Task Center 失源：`taskRunCoordinator` 的唯一生产者是 Kanban execution lifecycle；`TaskCenterView` 唯一宿主 `WorkspaceHome` 本身已无生产渲染点（`appShellLazyBoundaries.test.ts:103` 断言 render 不含它），唯一活入口是 `MessagesLinkedRunBanner`。
- `useLayoutNodes.tsx:1133` 根链挂 `useTaskRunStore()`（事件驱动 + 30s 兜底轮询 + window listener），移除即消一个根级轮询源。
- 两个功能都增加根 composition 的 hook 图与 domain bag 装配面，与 `docs/plans/2026-08-11-app-shell-cohesion-optimization.md` 的治理方向直接冲突。

## What Changes

- **Kanban 全链移除**：UI 入口（Sidebar/SidebarHeader/SidebarMarketLinks/QuickSwitcher/settings 快捷键）、`AppMode` 删 `"kanban"` 成员、`openKanbanShortcut` 前后端设置字段、render 挂载（lazyViews/renderAppShell/AppLayout/DesktopLayout）、两个 kanban section 整删、search/quickSwitcher 去 kanban 派生、17 个 domain keys 出账、`src/features/kanban/` 整目录、i18n/CSS/Tauri kanban image 命令。
- **Task Center 全链移除**：`MessagesLinkedRunBanner` 活链断掉（MessagesCore/messagesInput contract/messagesTypes/conversationCanvasNode/activeCanvasStore/useLayoutNodes）、`src/features/tasks/` 整目录（22 文件）、`WorkspaceHome.tsx` 整文件评估删除（已无生产渲染点）、browser-agent `TaskRunBrowserEvidenceRef` 类型下沉、i18n `taskCenter.ts` ×10。
- **保留项**：`isRewindSupportedThreadId` 搬家到 rewind 模块（rewind 功能在用，不随 kanbanHelpers 删除）；`AgentTaskScrollRequest` 全链保留（messages 域 status panel 定位，与 tasks 无关）；`TabBar` 的 `FolderKanban` 图标保留（projects tab 图标，非 kanban mode）。
- **Spec 治理**：7 个 specs 整刀 retire；`client-workflow-runtime-model` 等受影响 specs 改写（见 design.md 清单）。

## 目标与边界

- **目标**：代码库零 kanban / task-run 残留；app-shell domain keys 690 → ~655；根链少一个 30s 轮询；`check:app-shell:governance` 全绿。
- **边界**：纯删除 + 门禁链校准 + spec retire/改写；不以任何新功能替代。

## 非目标

- **不清理存量数据**（用户明确决策）：`app.json` 的 `"kanban"` / `"kanban_task_draft_*"` key、`~/.ccgui/client/kanban-images/`、client store `taskCenter.taskRuns` 全部保留不动；不写 migration、不加一次性清理。
- 不做 `settings.json` schema 收紧；`openKanbanShortcut` 残留 key 依赖 serde/TS 宽容反序列化（PR 内实测旧配置加载）。
- 不动 `src/features/update/generated/entries/*.json` 历史 changelog 与 `openspec/changes/archive/**`。

## Capabilities

### New Capabilities

无。

### Modified / Retired Capabilities

整刀 retire（7）：
- `kanban-task-scheduling`
- `kanban-task-chaining`
- `kanban-popover-dismiss-behavior`
- `kanban-trigger-active-state`
- `composer-kanban-linked-issues-surface`
- `agent-task-center`
- `agent-task-run-history`

改写（随实现 PR 逐个落 delta）：
- `client-workflow-runtime-model`（TaskRun 核心条款重写）
- `workspace-session-catalog-projection`（Task Run Links requirement）
- `openspec-trellis-status-panel-bridge`（:119 引用）
- `quick-context-switcher`（kanban entry）
- `codex-model-catalog-coverage` / `client-storage-performance` / `startup-css-loading-performance` / `composer-file-reference-index-availability`（kanban/dictation 提及点）
- `app-shell-domain-context-isolation` / `app-shell-runtime-boundaries` / `app-shell-exhaustive-deps-stability`（17 keys 出账）

## Impact

| 层 | 影响面 |
|----|--------|
| app-shell | 17 domain keys 出账（modeRouting/workspaceNavigation/layout/fileEditor）、两个 section 整删、core sections 清理、layoutNodes 透传、governance freeze 表校准 |
| features | `features/kanban/`、`features/tasks/` 整目录；search/quick-switcher/settings/sidebar/composer 透传清理 |
| render | `lazyViews.tsx`、`renderAppShell.tsx`、`AppLayout.tsx`、`DesktopLayout.tsx` |
| services/Tauri | `services/tauri/kanbanImages.ts`、`client_storage.rs` kanban image fn、`types.rs` openKanbanShortcut |
| i18n/CSS | 10 locale kanban.ts + taskCenter.ts、kanban.css 2093 行、eager CSS 散落选择器 ~56 处 |
| Specs | 7 retire + 11 改写 |
| Docs | ownership matrix + 执行计划 Log 回写 |

## 风险

- **CSS 散落选择器**（composer/scrollbars/themes ~56 处 `.kanban-*`）：漏删留死样式、误删伤 composer 布局 → 逐条核对 DOM 归属。
- **gitSurface gating 测试语义**：`useAppShellDomainAssembly.gitSurfaceGating.test.tsx` 用 `"kanban"` 当非 git 表面用例 → 改用 `"extensions"` 重写。
- **Task Center spec 漂移**：`client-workflow-runtime-model` 把 TaskRun 定义为 client execution truth，不同步改写违反 openspec verify 红线。
- **settings schema**：`openKanbanShortcut` 删除属破坏性 schema 变更 → PR 内实测旧配置反序列化（当前 `Option<String>` + default，预期安全）。
