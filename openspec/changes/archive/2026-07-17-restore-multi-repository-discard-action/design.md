## Context

`DiffFileRow` 已根据 `section === "unstaged" && onDiscardFile` 渲染 `Undo2` action，single-repository `GitDiffPanel` 也已有 discard confirmation dialog。multi-repository 分支虽然复用了相同 row，却没有把 discard callback 从 `AppShell` 贯穿到 repository group，因此 action 被条件隐藏。

现有 Tauri service `revertGitFile(workspaceId, path, repositoryRoot?)` 已支持 repository scope。本次只需要补齐 frontend orchestration，并确保 dirty worktree 中的目标文件采用局部语义修改。

## Goals / Non-Goals

**Goals:**

- multi-repository unstaged rows 暴露与 single-repository 一致的 discard affordance。
- confirmation 前不执行 mutation；确认后使用显式 `repositoryRoot + path`。
- mutation 成功后刷新 multi-repository statuses。
- callback 与 dialog state 在 TypeScript 层表达 repository identity，避免同名 path 串仓。

**Non-Goals:**

- 不改变 backend Git revert semantics。
- 不引入跨 repository transaction 或 undo history。
- 不改变 staged row、commit composer、selection 或 preview behavior。

## Decisions

### 1. 复用 shared row 与 confirmation dialog

采用现有 `DiffFileRow` 的条件渲染和 `GitDiffPanel` dialog，而不是在 `GitMultiRepositoryChanges` 中创建第二套 UI。这样 icon、tooltip、keyboard/accessibility behavior 与单仓保持一致。

替代方案是在 repository group 内直接渲染 icon/dialog；该方案会复制 destructive action orchestration，后续文案或交互容易漂移，因此不采用。

### 2. dialog target 使用 discriminated union

discard pending state 区分 `current-repository` 与 `explicit-repository`，后者携带 `repositoryRoot`。确认 handler 根据 scope 调用对应 callback，避免以 nullable root 猜测目标，也保留现有 single-repository contract。

替代方案是只存 `paths` 并依赖当前 selected repository；当两个仓库存在相同 relative path 或 selection 变化时存在误回退风险，因此不采用。

### 3. mutation 与 refresh 分层

`AppShell` scoped handler 只调用 `revertGitFile(workspaceId, path, repositoryRoot)`；`GitDiffPanel` 在一组确认 mutation 全部成功后触发一次 repository status refresh。这样 service mutation 可复用，UI orchestration 避免逐文件重复刷新。

## Risks / Trade-offs

- [Risk] callback chain 跨越多个 layout type，遗漏任一层会让 icon 继续隐藏 → 通过 typecheck、symbol scan 与 component tests 验证完整链路。
- [Risk] 相同 relative path 被错误路由 → dialog target 强制携带 explicit `repositoryRoot`，测试两个 repository 同名文件。
- [Risk] mutation 失败后 UI 状态不一致 → 沿用现有 error propagation；只在全部成功后 refresh，dialog pending 期间禁用重复确认。
- [Trade-off] 继续保留 single 与 multi 两种 callback 签名，而非一次性统一 identity type → 降低本次回归范围，符合 YAGNI。

## Migration Plan

1. 扩展 frontend prop/type chain。
2. 增加 repository-aware dialog target 与 confirm orchestration。
3. 增加 focused tests 并执行 typecheck/lint/OpenSpec strict validation。
4. 回滚时删除新增 scoped callback 与 multi-repository forwarding；backend 和持久化数据无需迁移。

## Open Questions

- 无；现有 service contract 与 shared UI 足以完成本次变更。
