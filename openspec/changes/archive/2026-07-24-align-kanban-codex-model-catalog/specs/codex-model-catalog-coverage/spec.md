## ADDED Requirements

### Requirement: Kanban Codex Selector MUST Reuse The Hydrated Catalog

Kanban 任务创建与编辑 selector 在 engine 为 Codex 时，MUST 使用 Composer catalog owner 已 hydrate 的 Codex model facts，而不得以 engine detection status 中的硬编码 fallback list 覆盖该 catalog。非 Codex engine MUST 保持其既有 model source。

#### Scenario: Kanban shows the same Codex catalog facts

- **WHEN** 同一 workspace 的 Composer catalog owner 已组合 runtime、config、custom 或 built-in Codex models
- **AND** 用户在 Kanban 创建或编辑任务时选择 Codex
- **THEN** Kanban model selector MUST 按共享 catalog 的顺序展示相同 model ids 与 display labels
- **AND** engine detection status 中独有的 stale fallback model MUST NOT 额外出现

#### Scenario: Valid selection survives catalog refresh

- **WHEN** Kanban 当前选择的 Codex model 在 refreshed catalog 中仍然存在
- **THEN** selector MUST 保留当前 model id
- **AND** catalog refresh MUST NOT 无条件重置 draft 或 edit selection

#### Scenario: Missing selection falls back deterministically

- **WHEN** 当前 Codex model 不存在于 refreshed catalog
- **THEN** selector MUST 选择 catalog default model
- **AND** 若无 default model，则 MUST 选择首个 model
- **AND** 若 catalog 为空，则 MUST 将 selection 设为 empty

#### Scenario: Selected model reaches task payload

- **WHEN** 用户从共享 Codex catalog 选择 model 并创建或更新 Kanban task
- **THEN** task payload MUST 保留所选 model id
- **AND** 现有 `KanbanTask.modelId` storage 与 execution contract MUST 保持兼容
