## Context

消息幕布的 `GenericToolBlock` 只在 `changes[].diff` 可用时让 `FileChangeRow` 展开。对于 shell redirection 等 sparse payload，adapter 能识别新增文件 path/kind，却没有可靠正文；与此同时 `onOpenDiffPath` 已沿 `Messages -> ToolBlockRenderer -> GenericToolBlock` 传入，但共享 row 当前不消费它。Workspace Git diff backend 已支持 untracked content，因此缺口在幕布 fallback 编排，而不是 Git 能力。

## Goals / Non-Goals

**Goals:**

- 只为 `added + missing inline diff` 恢复 canonical diff 可达性。
- 保留已有 inline preview 的交互优先级与 lazy parse 性能守卫。
- callback 缺失或执行异常时保持 row 稳定。

**Non-Goals:**

- 不读取当前磁盘文件来伪造历史 inline diff。
- 不改变其他 change kind、status panel 或 Git backend。
- 不把所有 filename 恢复为通用链接。

## Decisions

### Decision 1: 在 `GenericToolBlock` 做语义 gating

`GenericToolBlock` 已持有 normalized change kind、diff presence 与 `onOpenDiffPath`，因此由它只为 `normalizedKind === "added" && !diffText` 构造 fallback callback。共享 `FileChangeRow` 只负责一个可选的 missing-diff action，不自行猜测 kind。

`item.output` 只有满足明确 unified/apply-patch header contract 时才能作为 diff fallback；普通 CLI/Markdown output 不参与 `+/-` 统计，避免把 list marker 误判为 deletion。

Alternative：在 `FileChangeRow` 对所有 `canExpand=false` 的行启用 navigation。拒绝，因为会改变 modified/delete/rename 的既有行为。

### Decision 2: inline diff 优先，canonical navigation 仅作 fallback

当 `diffText` 存在时继续使用 `loadDiff` 和 row toggle；仅缺失时调用 `onOpenDiffPath(filePath)`。这保证已有 add patch 不发生双触发。

Alternative：无条件让 filename 可点击。拒绝，因为它会恢复已明确废弃的全局 filename link 语义，并影响其他工具行。

### Decision 3: 同步防御 callback 异常

missing-diff action 使用 `try/catch` 隔离 host callback，避免外部 routing 异常破坏 conversation interaction。callback 不存在时不提供 action，row 仍为纯展示。

Alternative：在 row 内异步读取文件并合成 diff。拒绝，因为这会引入 workspace trust boundary、race 和历史内容漂移。

## Risks / Trade-offs

- [Risk] 当前工作区文件已被删除或 Git diff 尚未刷新，navigation 后可能暂时没有 preview。→ 复用现有 Git panel refresh/fallback，不在幕布伪造数据。
- [Risk] 远程/历史 workspace 没有 `onOpenDiffPath`。→ action 保持 optional，缺失时维持原有非交互状态。
- [Trade-off] sparse add 不会直接在幕布内展示正文。→ 选择 canonical Git diff 的准确性与兼容性，避免读取当前磁盘冒充事件时 diff。

## Migration Plan

1. 增加 optional missing-diff action prop，不改变现有 prop contract。
2. 仅在 `GenericToolBlock` 的 added/no-diff 分支接入。
3. 通过 focused tests 与 typecheck 验证。

Rollback：移除新增 optional prop 与 added gating 即可，不涉及数据迁移或 backend contract。

## Open Questions

无。
