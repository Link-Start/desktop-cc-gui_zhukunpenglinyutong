## Why

Kanban 面板的 `TaskCreateModal` 仍从 engine detection status 读取 Rust 侧硬编码的 Codex model 列表，而 Composer 已使用 runtime `model/list`、config、custom models 与内置 catalog 合并后的可选模型。两条数据链路长期漂移，导致同一 workspace 中 Kanban 与对话框展示的模型数量、顺序和名称不一致。

## 目标与边界

- Kanban 创建/编辑任务选择 Codex 时，复用 Composer 上游已经 hydrate 的 Codex model catalog。
- 保持 Claude 等其他 engine 的现有模型来源不变。
- 保持 `KanbanTask.modelId` 与 task run payload contract 不变。
- catalog 更新时保留仍有效的当前选择，仅在选择失效时回退到 default/首项。

## 非目标

- 不修改 Codex runtime `model/list`、provider discovery 或 config refresh 的实现。
- 不删除 engine detection status 中的 degraded fallback model facts。
- 不新增 reasoning effort、provider profile 或任务数据迁移。
- 不重做 Kanban 创建任务窗体的视觉布局。

## What Changes

- 从 AppShell 将 Composer 使用的 Codex model catalog 传入 Kanban 创建/编辑任务链路。
- `TaskCreateModal` 在 `engineType === "codex"` 时使用共享 catalog 的 model id、顺序和 display label。
- 修正 model selection 收敛逻辑，避免 catalog refresh 无条件覆盖仍有效的草稿或编辑态选择。
- 增加 focused regression tests，锁定 catalog parity、selection preservation 与提交 payload。

## 方案对比

1. **采用：复用 frontend `useModels` catalog。** 它已经组合 runtime、config、custom 与 built-in model facts，和 Composer 共享同一上游事实源；改动局部且不增加 backend 探测成本。
2. **不采用：更新 Rust `get_codex_models()` 硬编码列表。** 只能暂时对齐内置项，仍会遗漏 runtime/config/custom models，并继续保留双份 catalog 与后续漂移风险。

## 验收标准

- 同一 workspace 下，Kanban 选择 Codex 后的模型 option ids、顺序和 display labels 与传给 Composer 的 hydrated catalog 一致。
- Rust engine status 中仅存在的旧 Codex fallback models 不再覆盖 Kanban 的共享 catalog。
- catalog refresh 后，仍存在的当前 model selection 保持不变；失效选择按 default/首项回退。
- 创建或编辑任务继续写入所选 `modelId`，现有任务存储和执行 contract 无破坏性变化。
- focused Vitest、TypeScript typecheck、ESLint、AppShell runtime contract 与 large-file sentry 通过。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `codex-model-catalog-coverage`: 将共享 Codex model catalog 的覆盖一致性扩展到 Kanban 任务创建/编辑 selector。

## Impact

- Frontend：`src/app-shell-parts/renderAppShell.tsx`、`src/features/kanban/components/KanbanView.tsx`、`KanbanBoard.tsx`、`TaskCreateModal.tsx` 及 focused tests。
- Behavior spec：`openspec/specs/codex-model-catalog-coverage/spec.md` 的 delta。
- API / storage / dependency：无变更。
