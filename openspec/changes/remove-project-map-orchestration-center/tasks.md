# Tasks: remove-project-map-orchestration-center

<!--
 执行规则（与 design.md §3/§4 一一对应）：
 - 严格按 S0→S5 顺序执行；每步独立 commit；gate 失败即停，修复或 revert 该步。
 - 只允许 design.md §1.2 清单内的文件修改；发现清单外引用 → 先登记到 design.md 再处理。
 - 每完成一条勾掉 checkbox；checkbox 是进度事实。
-->

## S0 基线（G0）

- [x] 0.1 运行 `npm run typecheck`，记录基线结果。
- [x] 0.2 运行 `npx vitest run src/features/project-map src/features/tasks src/features/messages src/features/layout src/app-shell-parts`，记录基线结果。
- [x] 0.3 基线全绿才继续；若有红，修复或登记 waiver 到 verification.md。

## S1 共享事件总线迁移（G1）

- [x] 1.1 新建 `src/features/tasks/utils/taskRunNavigationEvents.ts`，逐字复制 `OPEN_TASK_RUN_EVENT` / `dispatchOpenTaskRunEvent` / `readOpenTaskRunEvent`（事件名 `ccgui:open-task-run` 不变）。
- [x] 1.2 新增 `taskRunNavigationEvents.test.ts`：dispatch→read 闭环 + 空 runId 守卫两个用例。
- [x] 1.3 `TaskCenterView.tsx:5-8` import 改路径（仅 `OPEN_TASK_RUN_EVENT`）。
- [x] 1.4 `MessagesLinkedRunBanner.tsx:3` import 改路径。
- [x] 1.5 `Messages.test.tsx:14-16` import 改路径。
- [x] 1.6 **Gate G1**：`npx vitest run src/features/messages/components/Messages.test.tsx src/features/tasks/components/TaskCenterView.test.tsx src/features/tasks/utils/taskRunNavigationEvents.test.ts` + `npm run typecheck` 全绿，commit。

## S2 剥 app-shell 派发回调（G2）

- [x] 2.1 `useAppShellKanbanExecutionSection.ts` 删 `:25-31` import、`:204-369` `handleDispatchOrchestrationTask`、`:1610` return 导出（其余行不动）。（另级联清理仅被派发回调使用的 `patchTaskRun`/`saveTaskRunStore`/`activeWorkspace`/`workspaces` 未使用符号，已登记 design.md §1.2）
- [x] 2.2 `layoutNodesTypes.ts` 删 `:8`、`:669-673`、`:1152` 相关条目。**（执行调整：挪入 S3 commit——contract 先于消费方删除会导致 S2 typecheck 红，违背"每步可编译"原则；已登记 verification）**
- [x] 2.3 `useAppShellLayoutNodesSection.tsx` 删 `:390`、`:2211` 两处接线。
- [x] 2.4 `useAppShellSections.kanban-text.test.ts` 删 `:171` "orchestration dispatch wired" 整例。（连带删除仅含该例的 describe 块；并同步清理 `useAppShellSections.ts`、`appShellActionBoundaries.ts` 及其 test 中的同名字段，已登记 design.md §1.2）
- [x] 2.5 **Gate G2**：`npx vitest run src/app-shell-parts` + `npm run typecheck` 全绿（kanban 用例零修改通过），commit。

## S3 剥 useLayoutNodes 装配与悬空入口（G3）

- [x] 3.1 `useLayoutNodes.tsx` 删 `:58-80` import、`:207-228` projection signature、`:2233-2473` 状态与 8 handler、`:2475-2519` 渲染切换（三元改恒渲染 ProjectMap 面板）。（含 2.2 挪入的 `layoutNodesTypes.ts` 三处；级联清理仅服务编排代码的 `buildSpecWorkspaceSnapshot`/`SpecWorkspaceSnapshot`/`patchTaskRun`/`saveTaskRunStore` import）
- [x] 3.2 `useLayoutNodes.client-ui-visibility.test.tsx` 删 `:1008` option mock。
- [x] 3.3 `TaskCenterView.tsx` 删 `:87` 编排事件转发；`RunDetailSurface.tsx` 删 `:152-153` "打开编排任务"按钮。（连带删除完整 prop 链，已登记 design.md §1.2）
- [x] 3.4 `TaskCenterView.test.tsx` 删编排符号与 `:94-114` 用例。
- [x] 3.5 `ProjectMapPanel.tsx` 删 `:17-22`、`:104,115`、`:149,167`、`:233-234`、`:1215-1255`、`:1924,1937`。
- [x] 3.6 `ProjectMapDetailPanel.tsx` 删 `:71-85,103,116,147,160`；`projectMapPanelModel.ts:105`、`ProjectMapPanelSurfaces.tsx:12` 各一处。（级联删 `projectMapPanelModel.ts` 未使用 import，已登记）
- [x] 3.7 `ProjectMapPanel.test.tsx` 删 `:6` import 与编排 draft 用例 2 个（`:507`/`:516` 两个 sourceFocusNodeId 用例不引用模块、测试保留 prop，按边界保留，已登记 design.md §4.3）。
- [x] 3.8 **Gate G3**：`npx vitest run src/features/layout src/features/project-map src/features/tasks` + `npm run typecheck` 全绿，commit。

## S4 删模块本体与周边资产（G4）

- [ ] 4.1 删除 `src/features/agent-orchestration/` 整目录（31 文件，含 14 个测试）。**删除前复核**：命令目标必须是该精确路径，不得触碰 `src/features/messages/orchestration/`。
- [ ] 4.2 删除 10 语言包 `src/i18n/locales/*/agentOrchestration.ts` 及各 `index.ts` 的 import/spread 注册两行。
- [ ] 4.3 删除各语言包 `projectMap.ts:764-781` 的 `orchestration.*` keys（约 10/语言）与 `taskCenter.ts:27,49` 2 keys。
- [ ] 4.4 `workspace-home.css` 按 design.md §4.4 规程逐段删除 `orchestration-center__*` 选择器（157 处），核对无连带删除。
- [ ] 4.5 全仓 grep 复核：`agent-orchestration`、`OrchestrationCenterView`、`TASK_MODULE_ENTRYPOINTS_ENABLED`、`agentOrchestration` 零命中（archive/docs 历史文档除外）。
- [ ] 4.6 **Gate G4**：`npm run typecheck` + `npm run lint` + `npm run test`（全量）全绿，commit。

## S5 终验与 OpenSpec 收尾（G5）

- [ ] 5.1 删除 `openspec/specs/agent-task-orchestration-center/` 目录（spec delta 已声明 REMOVED）。
- [ ] 5.2 运行 `openspec validate --all --strict --no-interactive`。
- [ ] 5.3 手工 smoke：启动应用 → Project Map 面板正常渲染且无编排切换入口；kanban 创建/执行一个任务正常；幕布关联运行 banner 点击跳转 Task Center 正常。
- [ ] 5.4 撰写 verification.md（基线记录、各 gate 结果、smoke 证据）。
- [ ] 5.5 更新 `openspec/changes/README.md`（active table 进度），按流程 sync/archive。
