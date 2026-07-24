# Proposal: remove-project-map-orchestration-center

<!--
 本提案是"删除 Project Map 内嵌编排中心（Orchestration Center）"的唯一事实源。
 删除边界按文件级枚举，未列入的文件一律不许动（见 design.md 边界矩阵）。
 调研依据：docs/reports/client-aux-modules-optimization-report-2026-07-24.md（P0-2 的"或明确删除"分支）
 + 2026-07-24 全仓引用扫描（见 design.md §1 影响面地图）。
-->

## Why

产品决策：编排中心（Project Map 面板内的 Work Queue / Orchestration Center 切换视图）本身做得不好，用户明确要求清掉，而不是按调研报告 P0-2 的另一分支"打开 `TASK_MODULE_ENTRYPOINTS_ENABLED` 开通 dispatch"。

保留它的持续成本（即使 dispatch 被 flag 锁死、入口半拆除）：

1. **死代码持续误导**：`src/features/agent-orchestration/` 共 31 文件 / ~4940 行（含 14 个测试），dispatch 链路（按钮、配置面板、`dispatchTask.ts` 172 行、app-shell 侧 ~166 行真实派发逻辑）全部建成但被 `OrchestrationCenterView.tsx:21` 的 `TASK_MODULE_ENTRYPOINTS_ENABLED = false` 永久锁死，AI 协作者与后来者经常改到不可达的代码。
2. **占位腐蚀邻居**：Project Map 的节点→任务草稿入口（`ProjectMapDetailPanel` prop 带 `_` 前缀闲置、按钮隐藏）、Task Center 的"打开编排任务"按钮（`RunDetailSurface.tsx:152`）都是指向一个不可用 surface 的悬空入口。
3. **维护税**：10 个语言包各 ~150 条 `agentOrchestration.*` key、`workspace-home.css` 157 处 `orchestration-center__*` 选择器、295 行 main spec，全部服务一个不可达功能。

删除的代价可控：kanban 执行链（`src/features/kanban/**`）对编排模块**零引用**；对话幕布（`src/features/messages/`）仅通过 1 个共享事件总线符号浅接触，迁移后即脱钩。

## 目标与边界

### 目标（in-scope，文件级枚举）

- **整体删除** `src/features/agent-orchestration/` 目录（31 文件），**前置例外**：先将其中的共享事件总线符号迁出（见下）。
- **迁移共享事件总线**：`OPEN_TASK_RUN_EVENT` / `dispatchOpenTaskRunEvent` / `readOpenTaskRunEvent` 原样迁至 `src/features/tasks/utils/taskRunNavigationEvents.ts`（事件名字符串不变，行为零变化）；编排专属的 `OPEN_ORCHESTRATION_TASK_EVENT` / `dispatchOpenOrchestrationTaskEvent` / `readOpenOrchestrationTaskEvent` 随模块删除。同步更新 3 处 import：`TaskCenterView.tsx:5-8`、`MessagesLinkedRunBanner.tsx:3`、`Messages.test.tsx:14-16`。
- **剥离 app-shell 派发回调**：`useAppShellKanbanExecutionSection.ts` 仅删 `:25-31` import、`:204-369` `handleDispatchOrchestrationTask`、`:1610` return 导出，共 ~170 行；其余 ~1440 行 kanban 执行逻辑一字不动。
- **剥离挂载装配**：`useLayoutNodes.tsx` 删编排 import（`:58-80`）、状态与 8 个 handler（`:2233-2473`）、渲染切换（`:2475-2519`，三元改回恒渲染 Project Map 面板）；`layoutNodesTypes.ts` 删 `onDispatchOrchestrationTask` option（`:8, 669-673, 1152`）；`useAppShellLayoutNodesSection.tsx` 删两处接线（`:390, 2211`）。
- **清悬空入口**：Task Center 的"打开编排任务"按钮与事件转发（`RunDetailSurface.tsx:152-153`、`TaskCenterView.tsx:87`）；Project Map 节点→任务草稿残留（`ProjectMapPanel.tsx` import/handler/传参约 10 处、`ProjectMapDetailPanel.tsx:71-85,103,116,147,160`、`projectMapPanelModel.ts:105`、`ProjectMapPanelSurfaces.tsx:12`）。
- **清周边资产**：10 语言包 `agentOrchestration.ts` 及注册行、`projectMap.orchestration.*`（每语言约 10 keys）、`taskCenter.openOrchestrationTask`（2 keys）；`workspace-home.css` 中 157 处 `orchestration-center__*` 选择器（约 `:571-1377` 区间，**逐段核对，区间内的非编排选择器保留**）。
- **移除 main spec**：`openspec/specs/agent-task-orchestration-center/`（295 行，14 个 Requirement 全部 REMOVED，见本 change 的 spec delta）。
- **同步清理测试**：模块内 14 个测试随目录删除；模块外修改 `ProjectMapPanel.test.tsx`、`TaskCenterView.test.tsx`、`Messages.test.tsx`、`useLayoutNodes.client-ui-visibility.test.tsx:1008`、`useAppShellSections.kanban-text.test.ts:171`（编排 dispatch 用例整例删除）。

### 边界（hard boundary，删除范围限定死、不扩散）

**唯一允许的跨模块修改类型 = "删除对编排模块的引用"**。任何文件只允许删除/改路径，不允许借机重构、改名、格式化、调整无关逻辑。每个外部文件的修改点已在 design.md §3 给出行级清单；实现时发现清单外的新引用，必须先补登记再处理，不许顺手删。

## 非目标

以下各项**明确不在本 change 范围**，实现时触碰即视为越界：

- **不动共享 TaskRun 基础设施**：`src/features/tasks/types.ts:75,126` 的 `orchestrationTaskId?` 可选字段、`taskRunStorage.ts:263,282,388-390` 的 `source === "orchestration"` 分支保留为死字段/死分支（无害），留待后续独立 change 评估。
- **不动 kanban 执行链**：`src/features/kanban/**` 与 `useAppShellKanbanExecutionSection.ts` 的 kanban 部分（调度、链式任务、telemetry、完成检测）保持原样。
- **不动对话幕布**：`src/features/messages/**` 全部保留——**特别注意** `src/features/messages/orchestration/` 目录是 2026-07-21 重构拆出的消息组装控制器，名字含 "orchestration" 但**与编排中心无关，严禁误删**；`MessagesLinkedRunBanner` 保留，仅改 import 路径。
- **不开通 dispatch**：不打开 `TASK_MODULE_ENTRYPOINTS_ENABLED`，不补手动建任务表单（该分支已被产品决策否决）。
- **不做本地数据迁移**：旧客户端 store key `"agentOrchestration.tasks"` 的孤儿数据不清理（读取方删除后自然无影响）。
- **不动 archive**：`openspec/changes/archive/**` 的历史 change 只读不改。
- **不引入任何新依赖、新 UI、新 i18n key、新 Rust/IPC contract**。

## What Changes

- **BREAKING（内部 surface）**：Project Map 面板不再存在 Orchestration Center / Work Queue 切换视图；面板恒渲染 Project Map。
- **BREAKING（内部 contract）**：`useLayoutNodes` options 移除 `onDispatchOrchestrationTask`；`OrchestrationCenterView` 及全部 `Orchestration*` 类型、provider、store、dispatch/review utils 删除。
- **事件总线搬家不搬家名**：`ccgui:open-task-run` 事件名与 payload 形状不变，仅模块归属从 `agent-orchestration/utils/navigationEvents.ts` 迁至 `tasks/utils/taskRunNavigationEvents.ts`；`ccgui:open-orchestration-task` 事件随之消亡。
- Task Center run 详情不再提供"打开编排任务"按钮；Project Map 节点详情彻底移除（本已隐藏的）任务草稿入口。
- 10 语言包各减重 ~150 keys；`workspace-home.css` 减重约 800 行。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-task-orchestration-center`：**整体移除**（14 个 Requirement 全部 REMOVED，含 Reason/Migration，见 `specs/agent-task-orchestration-center/spec.md`）。Project Map、Task Center、消息幕布的相关行为以各自既有 capability spec 为准，本 change 不修改它们的 spec。

## Impact

- Frontend：删除 `src/features/agent-orchestration/**`；修改 `useLayoutNodes.tsx`、`layoutNodesTypes.ts`、`useAppShellLayoutNodesSection.tsx`、`useAppShellKanbanExecutionSection.ts`、`ProjectMapPanel.tsx`、`ProjectMapDetailPanel.tsx`、`projectMapPanelModel.ts`、`ProjectMapPanelSurfaces.tsx`、`TaskCenterView.tsx`、`RunDetailSurface.tsx`、`MessagesLinkedRunBanner.tsx`（仅 import）、`src/i18n/locales/**`、`src/styles/workspace-home.css`、上述 6 个测试文件；新增 `src/features/tasks/utils/taskRunNavigationEvents.ts`（纯迁移）。
- Runtime/API：无 Tauri command、storage schema、IPC、Rust 变更。
- Dependencies：无新增、无移除。
- 本地数据：旧 store key `"agentOrchestration.tasks"` 成为孤儿，无读取方，无崩溃风险。

## 技术方案对比

| 选项 | 做法 | 取舍 |
|---|---|---|
| **推荐：整体删除 + 事件总线迁移** | 按 design.md 五步顺序删，共享符号先迁后删 | 彻底消除误导与维护税；边界可控；kanban/幕布零影响 |
| 备选 A：开通 dispatch（报告 P0-2 分支） | 打开 flag + 补表单 | 已被产品决策否决：功能本身做得不好 |
| 备选 B：仅隐藏入口保留代码 | 删 UI 入口，保留模块 | 死代码问题原样保留，不符合"清掉"诉求 |

## 验收标准

- `src/features/agent-orchestration/` 目录不存在；全仓 grep `agent-orchestration`、`OrchestrationCenterView`、`TASK_MODULE_ENTRYPOINTS_ENABLED` 零命中（archive/docs 历史文档除外）。
- `ccgui:open-task-run` 事件链路可用：幕布 `MessagesLinkedRunBanner` 点击仍能跳转 Task Center 对应 run（由 `Messages.test.tsx` / `TaskCenterView.test.tsx` 修改后用例兜底）。
- Project Map 面板正常渲染、无编排切换入口；Task Center run 详情无"打开编排任务"按钮。
- kanban 看板调度/执行/链式任务行为与删除前一致（既有 kanban 相关测试不修改即通过）。
- 每步删除后的分层测试 gate 全部通过（见 tasks.md 各阶段 gate），最终 `npm run typecheck`、`npm run test`、`npm run lint` 全绿；`openspec validate --all --strict --no-interactive` 通过。
