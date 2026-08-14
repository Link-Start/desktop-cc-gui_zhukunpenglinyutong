# codex-model-catalog-coverage delta — remove-kanban-and-task-center

## REMOVED Requirements

### Requirement: Kanban Codex Selector MUST Reuse The Hydrated Catalog
**Reason**: Kanban 任务创建/编辑 selector 已随看板模式删除；`KanbanTask.modelId` 不再有产品入口。
**Migration**: Composer 仍是 Codex catalog owner。存量 kanban store 中的 modelId 保留不动，不再被读取或执行。
