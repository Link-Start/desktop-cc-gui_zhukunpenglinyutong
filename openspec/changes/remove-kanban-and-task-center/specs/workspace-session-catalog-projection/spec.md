# workspace-session-catalog-projection delta — remove-kanban-and-task-center

## REMOVED Requirements

### Requirement: Workspace Projection SHALL Keep Task-Run Aggregates Separate From Session Membership
**Reason**: Task Center / TaskRun workspace 聚合面已删除；不再存在独立的 workspace-level task-run projection。
**Migration**: Session catalog membership 仍只由 session projection resolver 决定。存量 `taskCenter.taskRuns` 保留不动，不投影到 workspace surface。

### Requirement: Workspace Projection SHALL Expose Task Run And Orchestration Links Separately From Session Membership
**Reason**: TaskRun / Task Center 链接面删除。Orchestration 任务与 session 的关联若仍存在，不得再经 TaskRun aggregate 表达。
**Migration**: Orchestration 若展示任务-会话关联，使用 orchestration 自身 projection；session count 仍只计 session membership。

## MODIFIED Requirements

### Requirement: Workspace Session Projection SHALL Treat Folder Tree As Organization Only

共享 workspace session projection MUST 将 folder tree 作为 presentation/organization layer，而不是 membership resolver；sidebar 与 Session Management 的 strict project scope 仍 MUST 由同一 resolver 决定。

#### Scenario: folder tree does not widen project scope
- **WHEN** 某 session 被分配到当前 project 的 folder
- **THEN** 该 session 仍 MUST 满足当前 project projection membership 才能显示在 strict project view
- **AND** folder assignment MUST NOT 让其它 project 的 session 进入当前 project projection

#### Scenario: sidebar count is not inflated by folders
- **WHEN** sidebar 或 New Home / HomeChat 展示 project session count
- **THEN** 系统 MUST 按 shared active projection 计算 session membership
- **AND** MUST NOT 因 folder 数量、folder nesting 或已删除的 TaskRun/Kanban 条目增加 session count

#### Scenario: root and folder views share degradation markers
- **WHEN** 某 engine/source 历史读取失败导致 projection degraded
- **THEN** root view 与 folder view MUST 暴露一致的 degraded marker
- **AND** folder tree MUST NOT 把 partial result 渲染成完整项目事实
