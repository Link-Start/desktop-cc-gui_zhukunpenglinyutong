# Multi-Repository Git Commit Workspace Contract

## Scope

适用于 `src/features/git/**`、`src/features/app/hooks/useGitCommitController.ts`、`src/services/tauri/git.ts` 与 `src-tauri/src/git/**` 的多 repository status、selection、stage、commit、push 和 branch update 链路。

## Identity Contract

- Git operation identity MUST 使用 `workspaceId + repositoryRoot`。
- `repositoryRoot === undefined/null`：legacy configured Git root fallback。
- `repositoryRoot === ""`：workspace root repository。
- non-empty `repositoryRoot`：normalized workspace-relative discovered child repository。
- explicit invalid/unknown/escaping repository root MUST return error，禁止 fallback 到 configured root。

## Signatures

```ts
getGitStatus(workspaceId, repositoryRoot?)
stageGitFile(workspaceId, path, repositoryRoot?)
stageGitAll(workspaceId, repositoryRoot?)
unstageGitFile(workspaceId, path, repositoryRoot?)
commitGit(workspaceId, message, repositoryRoot?)
pushGit(workspaceId, options?, repositoryRoot?)
pullGit(workspaceId, options?, repositoryRoot?)
syncGit(workspaceId, repositoryRoot?)
fetchGit(workspaceId, remote?, repositoryRoot?)
getGitDiffs(workspaceId, repositoryRoot?)
getGitFileFullDiff(workspaceId, path, repositoryRoot?)
getGitCommitHistory(workspaceId, { ..., repositoryRoot? })
getGitCommitDetails(workspaceId, commitHash, maxDiffLines?, repositoryRoot?)
getGitCommitDiff(workspaceId, sha, { path?, contextLines?, repositoryRoot? })
getGitPushPreview(workspaceId, { remote, branch, limit?, repositoryRoot? })
```

Rust Tauri/daemon 对应 command 参数使用 `repository_root: Option<String>`，remote forwarding payload 使用 camelCase `repositoryRoot`。

## Adaptive UI Contract

| Repository topology | Render shape | Status source |
|---|---|---|
| 0/1 repository | existing compact `GitDiffPanel`，无额外 repository header | existing `useGitStatus` |
| 2+ repositories | dirty repositories 分组，header 显示 name/branch/count | `useMultiRepositoryGitStatus` scoped parallel reads |

- clean repository 不创建空 group。
- 同名 repository-relative path 必须按 `repositoryRoot` 隔离 selection 与 mutation。
- repository header selection 是 tri-state；file selection 保留 existing staged-default semantics。
- multi repository status partial failure 只影响对应 group。
- workspace 切换后 stale response MUST 被 request id 拒绝。
- single 与 multi diff mode MUST 使用同一 vertical composition：changed-file content 是独立 scroll region，commit composer 位于 DOM 尾部并固定在 panel bottom。
- 禁止让 textarea/commit button 跟随长文件列表滚出视口，也禁止 footer 覆盖最后一行文件。

## Git History Independent Repository Selection

- existing workspace/worktree `GitHistoryProjectPicker` MUST 始终保留为第一层，禁止以 repository list 替换。
- `GitHistoryPanel` 在当前 History workspace 的 `repositories.length > 1` 时 MUST 增加第二个 `GitHistoryProjectPicker` 展示 discovered repositories。
- repository option identity MUST encode `repositoryRoot`，包括 workspace-root `""`；不得用 display name 作为 identity。
- AppShell MUST 维护独立 selected History project workspace / `gitHistoryRepositoryRoot`。
- repository selection MUST 只更新 `gitHistoryRepositoryRoot`；MUST NOT 调用 `addWorkspaceFromPath`、修改 workspace catalog 或触发主 `setActiveWorkspaceId`。
- Git History commands MUST 继续使用 selected project `workspaceId`，并通过 optional `repositoryRoot` 复用 backend `resolve_git_root_for_scope`；omitted scope MUST 保持 single-repository legacy behavior。
- `GitHistoryWorktreePanel` 的 status、stage、unstage、revert、commit 与 commit message generation MUST 使用同一个 selected `repositoryRoot`。
- Git History worktree component lifetime MUST 绑定 `workspaceId + repositoryRoot`；切仓时 MUST remount repository-local state，隔离旧仓仍在执行的 mutation、commit message generation 与同路径 selection override。
- repository scope change MUST 立即将 parent worktree summary 清零；新 status 成功后再写入当前仓统计，失败时禁止保留旧仓 changed files/additions/deletions。
- Git History 左侧 worktree root label MUST 跟随 selected repository display name/path leaf，禁止继续显示 configured fallback repository name。
- active main workspace change MUST invalidate stale history selection request，并将 history scope 重置到新 workspace。
- repository summaries MUST 跟随 independent History workspace 一次性刷新并拒绝 stale response；禁止新增 polling，也禁止错误复用主 active workspace 的 summaries。

## Commit Message Generation Contract

- single mode 继续使用 `selectedPaths?: string[]`。
- multi mode 使用 `repositorySelections?: Array<{ repositoryRoot: string; selectedPaths: string[] }>`，每个 scope MUST 经 `resolve_git_root_for_scope` 校验后收集 diff。
- multi repository composer MUST 显示与 single mode 相同的 `CommitMessageEngineIcon`、engine/language menu、loading/error state。
- multiple scoped diffs MUST 合并为一次 prompt 与一次 generated message；禁止只读取第一个 repository 或 fallback 到 configured root。

## Mutation Contract

- 多 repository commit MUST 按 root-first + normalized path 顺序执行。
- 每个 repository 产生独立 commit，共用同一 commit message。
- 某 repository commit failure 不阻塞后续 repositories。
- 成功 group 刷新；失败 group 保留 changes/selection 以供 retry。
- commit-and-push 只 push 本轮 committed repositories，push failure 与 commit failure 分开归因。
- Git 不提供跨 repository atomic transaction；禁止伪造全局 rollback 成功语义。

## Error Matrix

| 场景 | 行为 |
|---|---|
| explicit repository update 且未全局 selected | 仍使用 active workspace id + explicit root 执行 |
| one status request fails | 其他 groups 正常显示，失败 group 展示 readable error |
| one commit fails | 继续后续 repository，最终逐 repository 汇总 |
| commit succeeds but push fails | commit 保持成功，push 单独失败 |
| root escapes workspace | backend reject，不执行 Git command |
| History switches from repository A to B | branch/status/history/detail requests use the same selected `repositoryRoot`; stale A responses MUST NOT become visible |
| History mutation or AI generation for A resolves after switching to B | operation stays scoped to A, but its local UI result MUST NOT write into B; B summary/selection/message remain repository-local |

## Good / Base / Bad Cases

- Good：右键 child repository 更新时直接传 `repositoryRoot`；即使 selected repository 为 `null`，仍从 active workspace 取得 `workspaceId`。
- Good：两个 repositories 都有 `pom.xml` 时，selection key 包含 repository root，各自 stage/commit。
- Good：multi commit 中 repository A 失败后继续 B，并只对成功 commit 的 repository 执行 push。
- Base：调用方不传 `repositoryRoot`，继续使用 configured Git root，single repository UI 不增加 group header。
- Bad：先写全局 `selectedRepositoryRoot` 再延迟执行 mutation；快速切换会产生 target race。
- Bad：把多个 repositories 的 relative paths flatten 成一个 `Set<string>`，同名 path 会互相覆盖。
- Bad：把 sequential multi commit 描述成 atomic transaction，或在 partial failure 后清除所有 selection/message。

## Tests Required

- `useAppShellGitWorkspaceOpsSection.test.tsx`：未 selected repository 的 explicit update。
- `useMultiRepositoryGitStatus.test.tsx`：single bypass、parallel multi、partial failure。
- `GitMultiRepositoryChanges.test.tsx`：multi groups 与 same-relative-path isolation。
- `multiRepositoryCommit.test.ts`：deterministic order、partial failure、successful-only push。
- `GitHistoryPanel.test.tsx`：multi repository picker 显示、repository-root selection，以及切仓后 branch/history/detail payload、左侧 worktree scope prop 与 root label 刷新。
- `GitHistoryWorktreePanel.test.tsx`：真实组件 A→B 切仓后旧文件消失、新文件出现，status/stage/commit/generation payload 使用 B 的 `repositoryRoot`；覆盖 in-flight mutation、in-flight generation、same-path selection 与 summary reset；legacy single mode 保持旧调用 arity。
- `GitDiffPanel.test.tsx` / `GitMultiRepositoryChanges.test.tsx`：content precedes bottom composer。
- `src/services/tauri.test.ts`：`repositoryRoot` payload mapping。
- Rust `scoped_git_root_is_cross_platform_and_stays_inside_workspace`：empty/nested/escape/unknown root boundary。

## Validation

```bash
npm run typecheck
npm run check:runtime-contracts
npm exec vitest run src/features/git/components/GitMultiRepositoryChanges.test.tsx \
  src/features/git/hooks/useMultiRepositoryGitStatus.test.tsx \
  src/features/git/utils/multiRepositoryCommit.test.ts
cargo test --manifest-path src-tauri/Cargo.toml scoped_git_root_is_cross_platform_and_stays_inside_workspace
```
