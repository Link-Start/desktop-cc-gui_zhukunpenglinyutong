# Align Kanban Codex Model Catalog

## Goal

让 Kanban 面板的任务创建/编辑窗体与 Composer 复用同一份 hydrated Codex model catalog，消除 Rust engine status 旧硬编码列表造成的数量和展示漂移。

OpenSpec change：`align-kanban-codex-model-catalog`

## Requirements

- 将 AppShell 中 `useModels.models` 显式传递给 Kanban 任务创建链路。
- Codex 使用 shared catalog；其他 engine 保持现有 `EngineStatus.models` 来源。
- model label、id 与顺序保持 shared catalog 原样。
- catalog refresh 保留有效选择，仅对失效选择执行 default/首项/empty 回退。
- 不修改 task storage schema、runtime payload 或 backend engine detection。

## Acceptance Criteria

- [ ] Kanban Codex options 与 shared Composer catalog 的 ids/order/display labels 一致。
- [ ] 旧 Rust hardcoded-only model 不再污染 Kanban options。
- [ ] 有效选择在 catalog rerender 后保留，失效选择 deterministic fallback。
- [ ] 创建任务提交所选 `modelId`。
- [ ] focused Vitest、typecheck、lint、runtime contract、large-file sentry 与 OpenSpec strict validation 通过。

## Technical Notes

- 复用 `ModelOption` domain type，不复制 catalog merge 逻辑。
- 预计修改 `renderAppShell.tsx`、`KanbanView.tsx`、`KanbanBoard.tsx`、`TaskCreateModal.tsx` 与 focused test。
- 回滚只需移除 `codexModels` prop chain 并恢复旧 model resolution，无数据迁移。
