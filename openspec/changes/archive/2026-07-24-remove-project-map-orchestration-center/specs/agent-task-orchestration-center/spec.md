# Spec Delta: agent-task-orchestration-center (REMOVED)

<!--
 编排中心整体删除：main spec `openspec/specs/agent-task-orchestration-center/spec.md`
 的全部 14 个 Requirement 随本 change 移除。
 Migration 共同口径：Project Map 面板恒渲染 Project Map；任务执行语义继续由
 kanban / Task Center / TaskRun 各自既有 capability 承担；不存在数据迁移需求
 （本地 store key "agentOrchestration.tasks" 成为孤儿，无读取方）。
-->

## REMOVED Requirements

### Requirement: Orchestration dispatch accepts Browser Snapshot v2 as input evidence
**Reason**: 产品决策整体删除编排中心；dispatch 链路本就被 `TASK_MODULE_ENTRYPOINTS_ENABLED = false` 锁死不可达，其输入证据契约随之消亡。
**Migration**: 无。browser snapshot 证据如需服务其他 surface，由对应模块自有 contract 承担。

### Requirement: Orchestration uses engine-agnostic browser payloads
**Reason**: 编排中心整体删除，engine-agnostic payload 的编排侧消费方不复存在。
**Migration**: 无。

### Requirement: Orchestration Tasks SHALL support linked browser context evidence
**Reason**: `OrchestrationTask` 模型整体删除，linked browser context evidence 字段随类型删除。
**Migration**: 本地 store key `"agentOrchestration.tasks"` 成为孤儿数据，无读取方，无需迁移。

### Requirement: Orchestration Center Unit Tests SHALL Isolate Runtime Bridges
**Reason**: 模块内 14 个测试文件随 `src/features/agent-orchestration/` 目录整体删除，测试隔离要求不再存在。
**Migration**: 共享事件总线迁移后由 `src/features/tasks/utils/taskRunNavigationEvents.test.ts` 承担等价行为覆盖。

### Requirement: Agent tasks can consume Project Map spec task context
**Reason**: Project Map → 编排任务草稿 bridge 删除；`projectMapProvider.ts` 随模块删除。
**Migration**: Project Map 面板恒渲染 Project Map；节点详情不再提供任务草稿入口（该入口删除前已处于半拆除状态：prop 闲置、按钮隐藏）。

### Requirement: Orchestration Center SHALL Work Without Spec Or Workflow Providers
**Reason**: 编排中心整体删除，provider 缺失时的降级可用性要求随之消亡。
**Migration**: 无。

### Requirement: Orchestration Center SHALL Aggregate Work Items Through Providers
**Reason**: 6 个候选 provider（projectMap/specHub/trellis/taskRun/repositorySignal/manual）随模块整体删除。
**Migration**: 工作项聚合语义由 kanban 与 Task Center 各自既有能力承担。

### Requirement: Orchestration Task SHALL Preserve Source Evidence And Execution Scope
**Reason**: `OrchestrationTask` projection 模型整体删除。
**Migration**: 无。sourceRef 构造工具（`sourceRefs.ts`）随模块删除，无外部消费方。

### Requirement: Dispatch SHALL Require Explicit User Confirmation
**Reason**: dispatch 链路（确认面板、`dispatchTask.ts`、app-shell 派发回调）整体删除。
**Migration**: 任务执行派发语义继续由 kanban 执行链的既有确认交互承担。

### Requirement: Completed Runs SHALL Enter Review Gate Before Task Completion
**Reason**: review gate（`reviewTask.ts` 与 UI review action rail）随编排中心删除。
**Migration**: kanban 看板既有完成/审核语义不变，由 kanban 相关 capability spec 承担。

### Requirement: Orchestration Actions SHALL Be Bounded And Provider-Aware
**Reason**: action rail（open conversation / open source / retry / follow-up / archive）随编排中心 UI 删除。
**Migration**: Task Center run 详情的既有动作不变；"打开编排任务"按钮移除。

### Requirement: Orchestration Core SHALL Not Depend On Personal Or Repository-Specific Workflow Files
**Reason**: 编排核心整体删除，该边界约束不再有约束对象。
**Migration**: 无。

### Requirement: Project Map Work Queue SHALL Reflect Current Runtime Boundary
**Reason**: Project Map 面板内的 Work Queue / Orchestration Center 切换视图整体删除。
**Migration**: Project Map 面板恒渲染 Project Map；`isOrchestrationCenterOpen` 状态与切换路径删除。

### Requirement: Provider Candidate Dispatch SHALL Persist The Task Projection First
**Reason**: 候选派发持久化链路随 `dispatchTask.ts` 与编排 taskStore 删除。
**Migration**: TaskRun 基础设施保留（含 `orchestrationTaskId` 死字段与 `source === "orchestration"` 死分支，留待后续独立 change 清理）。
