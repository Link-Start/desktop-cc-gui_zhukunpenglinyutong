## Context

`useGitRepositories` owns the aggregate summary collection while `useAppShellGitWorkspaceOpsSection` derives `selectedRepositoryRoot` and mounts `useGitBranches` only when that selection is non-null. A transient empty aggregate currently makes the selection invalid, unmounts the branch workspace, and clears branch rows. `ComposerBranchBadge` has expansion state only for Recent/Local/Remote; the computed local/remote scopes are plain labels. FileTree repository actions already carry explicit repository identity, and the existing service supports `updateGitBranch(workspaceId, branchName, repositoryRoot)`.

## Goals / Non-Goals

**Goals:**

- Preserve last-known-good repository/branch UI across one transient empty aggregate sample.
- Add one independent collapsible scope layer without changing branch identity.
- Keep file-tree Update repository-scoped and reuse existing backend/service contracts.
- Provide deterministic pending and result feedback with focused regression tests.

**Non-Goals:**

- No Rust/Tauri changes or persisted Git root migration.
- No arbitrary-depth recursive branch tree.
- No changes to Git History branch context action semantics.

## Decisions

### Preserve aggregate last-known-good data at its owner

`useGitRepositories` will reject a single empty normalized response when the same workspace already has non-empty summaries. This prevents every downstream consumer from inventing its own guard. Workspace identity changes still clear immediately. A subsequent valid response resets the empty-sample guard.

Alternative: guard only `selectedRepositoryRoot`. That leaves file-tree repository decorations and other consumers flashing empty, so it is rejected.

### Use keyed inner-scope expansion state in the component

`ComposerBranchBadge` will keep a `Set<string>`-style keyed state for local and remote scope groups. Root branches remain direct rows. Search acts as a render-time reveal override and does not mutate stored expansion preferences. Menu close resets both top-level and inner-level preferences.

Alternative: recursively model every slash segment. The request asks for one additional layer; recursive navigation adds complexity and ambiguous branch/group collision behavior, so it is out of scope.

### Add a typed Update request and execute it before navigation

The repository action model will add an Update variant carrying `repositoryRoot` and `branchName`. FileTree builds it only when the repository summary is updateable. AppShell calls the existing update service with explicit scope, refreshes repositories/Git status, and reports the structured result. It will not first mutate persisted `gitRoot`, which would create a target race.

Alternative: publish an intent to Git History after selecting a new persisted root. Git History branch loading is asynchronous, so the current branch may still describe the previous repository; rejected.

## Error / Validation Matrix

| 状态 | 行为 |
|---|---|
| first empty summary after valid data | 保留 last-known-good summaries/selection |
| workspace id changes | 立即清空旧 selection 与 branches |
| scope collapsed | header 可见，leaf rows 隐藏 |
| search non-empty | matching scope 临时展开 |
| detached/unborn/unavailable/no branch | Update disabled |
| Update pending | 禁止重复触发 |
| success/no-op/blocked/error | 显示明确反馈并结束 pending |

## Risks / Trade-offs

- [真实 repository 集合变为空时会延迟一次采纳] → 只保留一个 empty sample；连续确认或 workspace switch 仍可收敛为空。
- [Update feedback 在 context menu 关闭后不可见] → 使用现有全局 toast/operation notice，而不是只依赖 submenu DOM。
- [action type 扩展遗漏 consumer] → 使用 exhaustive typed mapping 与 focused FileTree/AppShell tests。

## Migration Plan

1. 先增加 frontend guard 与测试。
2. 增加 scope toggle state/markup 与 component tests。
3. 扩展 repository action type和 AppShell wiring，复用既有 service。
4. 运行 focused tests、typecheck、lint、runtime contract 与 OpenSpec validation。

Rollback 只需回退 frontend 与本 change artifacts；backend contract 不受影响。

## Open Questions

- 无阻塞问题；本轮 scope depth 固定为一层。
