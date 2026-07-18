## Context

当前存在两条 Codex model 数据链：

```text
Composer
  useModels.models
  = runtime model/list + config model + custom models + built-in catalog

Kanban TaskCreateModal
  engineStatuses[codex].models
  = Rust detect_codex_status() -> get_codex_models() 旧硬编码列表
```

`engineStatuses` 的职责是 engine availability/detection；其中的 model facts 只是 degraded startup snapshot，不适合作为需要完整 catalog 的长期 UI source。`useModels.models` 已是 Composer 的 hydrated Codex catalog owner，并且在 AppShell 中始终存在，不依赖当前 active engine。

## Goals / Non-Goals

**Goals:**

- Kanban 创建/编辑任务的 Codex selector 与 Composer 共享同一上游 catalog。
- 保留 model id、顺序、display label 与 catalog refresh 行为。
- catalog 变化时保护有效的 draft/edit selection。
- 保持非 Codex engine 与 task execution payload 行为不变。

**Non-Goals:**

- 不让 `TaskCreateModal` 自行调用 `model/list` 或读取 localStorage。
- 不把 Composer 组件直接嵌入 Kanban。
- 不更改 Rust engine detection、任务 schema、reasoning effort 或 provider binding。

## Decisions

### 1. 通过显式 props 传递 `codexModels`

AppShell 将 `useModels.models` 以 `codexModels: ModelOption[]` 依次传给 `KanbanView`、`KanbanBoard` 和 `TaskCreateModal`。Modal 仅在 `engineType === "codex"` 时使用它，其他 engine 继续读取对应 `EngineStatus.models`。

选择该方案是因为数据 owner 与消费边界清晰，测试可以直接注入 catalog，也不会把 Kanban 耦合到 Composer hook 或 storage event。

备选方案是在 `renderAppShell` 临时改写 `engineStatuses[codex].models`。该方案文件更少，但会混淆 availability snapshot 与 hydrated catalog 的语义，并隐藏真实依赖，故不采用。

### 2. 展示值直接使用共享 catalog 的 `displayName`

不在 Kanban 复制 i18n model map 或重新格式化 model id。共享 catalog 已完成 runtime/config/custom label merge，Kanban 原生 `<select>` 只消费 `id` 与 `displayName`。

### 3. selection 采用 preserve-valid / fallback-invalid

当 engine 或 catalog 改变时：

1. 若当前 `modelId` 仍存在于目标 options，保持不变；
2. 否则选择 `isDefault` model；
3. 再否则选择首项；
4. 无 options 时设为 `null`。

这避免异步 catalog hydration 或 engine status refresh 无条件覆盖草稿、编辑态选择。

### 4. 初始化收敛必须等待目标 engine 生效

Modal 首次打开时，草稿或编辑任务会同时恢复 `engineType` 与 `modelId`。catalog normalization
不得使用同一 render 中旧 `engineType` 捕获的 options 覆盖刚恢复的 selection。组件以
feature-local ref 记录待生效的初始化 engine；只有实际 `engineType` 与该目标一致后，才执行
既有 preserve-valid / fallback-invalid 规则。

该 guard 只协调 Modal 本地 effects，不引入 timer、microtask、全局状态或新的跨组件抽象。

## Risks / Trade-offs

- [Risk] props 经过三层组件传递，增加少量显式接口代码。→ 保持 feature-local，不建立 context 或新 global store，避免过度抽象。
- [Risk] shared catalog 暂时为空。→ 沿用现有 empty option，并在 catalog hydrate 后按 fallback 规则自动收敛。
- [Risk] 编辑旧任务时 model 已从 catalog 移除。→ 明确回退到当前 default/首项，防止提交不可见 stale value。

## Migration Plan

1. 先增加 prop contract 与 focused tests。
2. 切换 `TaskCreateModal` 的 Codex model resolution。
3. 运行 focused test、typecheck、lint、AppShell runtime contract 与 large-file sentry。
4. 不需要数据迁移；既有 `KanbanTask.modelId` 原样兼容。

**Rollback：** 移除 `codexModels` prop chain，并恢复 Modal 只读取 `selectedEngine.models`。由于没有 storage/schema 变更，rollback 不需要数据修复。

## Open Questions

无。Managed provider profile binding 属于独立 cross-layer contract，不在本次 catalog parity 修复范围内。
