# remove-kanban-and-task-center — tasks

## 1. Spec & 契约对齐

- [x] 1.1 `openspec validate remove-kanban-and-task-center --strict --no-interactive` 通过
- [x] 1.2 改写类 spec delta 随对应实现 PR 逐个补齐（见 §7）

## 2. PR-K1 UI 入口 + mode 路由

- [x] 2.1 入口清理：`Sidebar.tsx:2225-2238`、`SidebarHeader.tsx:2,24`（KanbanModeToggle）、`SidebarMarketLinks.tsx:67-87`、`QuickSwitcher.tsx:47,63` + `quickSwitcherNavigationState.ts:52-54,97-99`、`settingsViewShortcuts.ts:15,60,203-207,621`、`usePrimaryModeShortcuts.ts:11-58`
- [x] 2.2 `src/types/settings.ts:53` AppMode 删 `"kanban"`；`openKanbanShortcut` 前端（:125 + useAppSettings:245）与 `src-tauri/src/types.rs`（4 处）同步删；实测旧 settings.json 反序列化
- [x] 2.3 render 挂载：`lazyViews.tsx:15-19`、`renderAppShell.tsx:358-359,530-560`、`renderAppShellTypes.ts:88-194`、`AppLayout.tsx:10-129`、`DesktopLayout.tsx:552-555`
- [x] 2.4 ⚠ 勿删 `TabBar.tsx:2,20` `FolderKanban`（projects 图标）

## 3. PR-K2 sections + search

- [x] 3.1 整删 `useAppShellKanbanExecutionSection.ts`（1483 行）+ `useAppShellKanbanComposerSection.ts`（558 行）
- [x] 3.2 `useAppShellSections.kanbanHelpers.ts`（122 行）整删，**`isRewindSupportedThreadId` 先搬家到 rewind 模块**（`core/useAppShellSections.ts:21` 在用）
- [x] 3.3 `core/useAppShellSections.ts` 36 处清理
- [x] 3.4 searchRadar 去 kanban 派生：`useAppShellSearchRadarSection.ts:137,182,296-302,801-804,818`
- [x] 3.5 `useAppShellSearchAndComposerSection.ts:114-118,212-273,643-653`
- [x] 3.6 features/search：`providers/kanbanProvider.ts` 整删、`useUnifiedSearch.ts:53-286`、`types.ts:5,41,72`、`SearchPalette.tsx:23,149,161,176`、`ranking/score.ts:12`、`perf/limits.ts:6`、`perf/evidence.ts:111-112`

## 4. PR-K3 Task Center 断链

- [x] 4.1 `MessagesLinkedRunBanner.tsx` 整删 → `MessagesCore.tsx:108,110,203,1799-1800` → `messagesInput.ts:21,122` → `messagesTypes.ts:19,111` → `conversationCanvasNode.tsx:47,65` → `activeCanvasStore.ts:30,70-71,104` → `useLayoutNodes.tsx:55,1133,1196-1199,1223,1248,1377`
- [x] 4.2 browser-agent 类型解耦：`TaskRunBrowserEvidenceRef` 下沉/内联；`src-tauri/src/browser_agent/types.rs:209` `linked_task_run_id` 顺手清
- [x] 4.3 `WorkspaceHome.tsx` 整文件 + `lazyViews.tsx:33-36` + `loadWorkspaceHomeStyles` + `workspace-home.css` 评估删除
- [x] 4.4 ⚠ 保留 `AgentTaskScrollRequest` 全链（messages 域，勿误删）

## 5. PR-K4 domain 层出账

- [x] 5.1 17 kanban keys 出账：`appShellDomainContexts.ts`（modeRouting/workspaceNavigation/layout×12/fileEditor×3）+ `buildAppShellDomainContextSlices.ts` 4 处 + `useAppShellDomainAssembly.ts` 38 处 + `appShellActionBoundaries.ts:17,98`
- [x] 5.2 `useKanbanDomainHost` 删除（`useModeDomainHosts.ts`）；`appModeSurfaceFlags.ts:12,20`
- [x] 5.3 门禁校准：`appShellDomainOwnershipGate.ts` freeze 表按实测更新 + 5 个关联测试
- [x] 5.4 `useAppShellDomainAssembly.gitSurfaceGating.test.tsx:49-81` 改用 `"extensions"` 重写
- [x] 5.5 刷新 `docs/plans/app-shell-ownership-matrix.md`

## 6. PR-K5 收尾删除

- [x] 6.1 整目录 `src/features/kanban/` + `src/features/tasks/` + `services/tauri/kanbanImages.ts`
- [x] 6.2 Tauri：`client_storage.rs:274-315,442-445` + `command_registry.rs:454`
- [x] 6.3 i18n：10 locale kanban.ts + taskCenter.ts + deferred/critical 接线 + 散 key；跑 `scripts/i18n/` 流水线
- [x] 6.4 CSS：`kanban.css`、`composer.kanban-mode.css`、`featureStyleLoaders.ts:120-124`、eager 散落 `.kanban-*` 逐条核对
- [x] 6.5 `migrateLocalStorage.ts:130,186-187`；`clientDocumentationData.ts` kanban 5 处 + tasks-status module；`check-messages-boundaries.mjs:23,35,54`
- [ ] 6.6 B1–B8 人工回归 + `openspec validate --all --strict --no-interactive`

## 7. 改写类 spec delta（随实现 PR 落）

- [x] 7.1 `client-workflow-runtime-model` TaskRun 条款重写（PR-K3）
- [x] 7.2 `workspace-session-catalog-projection` Task Run Links（PR-K3）
- [x] 7.3 `openspec-trellis-status-panel-bridge:119`（PR-K3）
- [x] 7.4 `quick-context-switcher`（PR-K1）
- [x] 7.5 `codex-model-catalog-coverage` / `client-storage-performance` / `startup-css-loading-performance` / `composer-file-reference-index-availability`（PR-K5 扫尾）
- [x] 7.6 app-shell 三 specs（PR-K4，17 keys 出账同步）

## 8. 每 PR 验收

- [x] `npm run check:app-shell:governance` + `npm run check:app-shell:runtime-contract` + `npm run typecheck` 绿
- [x] vitest 受影响套件绿（仓库标准姿势：`NODE_OPTIONS=--max-old-space-size=12288 npx vitest run --maxWorkers=1 --minWorkers=1 <paths>`）
- [ ] 完成后给摘要，等用户授权 commit
