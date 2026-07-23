## Context

当前 `GitMultiRepositoryChanges` 已将 direct file open、modal preview、stage、unstage、single discard 等 callback 包装为 `(repositoryRoot, path)`。唯独 center inline preview 仍向 `GitDiffPanel` 上层发送 `path`，而 `GitDiffPanelProps.onSelectFile`、`LayoutNodesFlatOptions.onSelectDiff` 和 `useGitPanelController.handleSelectDiff` 也只接受 path。

`useGitPanelController.activeDiffs` 的 local source 默认来自 `useGitDiffs(workspaceId)`，这是 workspace-root repository scope。Backend/frontend service 已支持 `getGitDiffs(workspaceId, repositoryRoot)`，因此缺口是 frontend selection identity 和 scoped fetch orchestration，不是 API 能力。

另外，`GitDiffPanelFileSections` 已有 unstaged-only `onDiscardFiles(paths)` header action，`GitDiffPanel` 也已有 `DiscardDialogTarget` 的 `explicit-repository` variant；multi-repository adapter只缺 group scope forwarding。Branch batch actions同样已有完整 handler，仅需要 presentation 重排。

## Goals / Non-Goals

**Goals:**

- 让 nested repository inline selection identity 完整且 request-local。
- 最大复用现有 service、canonical mapper、discard dialog 与 branch handlers。
- 保持 legacy single-repository、commit、PR 和 modal preview behavior。
- 为变更的跨组件 callback 补 focused regression tests。

**Non-Goals:**

- 不统一所有 Git state 到新 store。
- 不预取全部 repositories。
- 不改变 backend validation 或 mutation transaction model。

## Decisions

### Decision: Extend selection contract with optional repository scope

callback 统一为：

```ts
(path: string | null, repositoryRoot?: string | null) => void
```

- `undefined/null`：沿用 workspace-root local diff behavior。
- non-empty 或 explicit repository identity：保存到 `selectedDiffRepositoryRoot`，local diff source 改用 scoped fetch。
- `path === null`：同时清理 repository scope。
- active workspace change：清理 repository scope，禁止前一 workspace 的 nested repository identity 泄漏。

optional additive signature 保持现有 caller compatible，不创建新的 selection object abstraction。

### Decision: Scoped local diffs are loaded on demand

仅当 `diffSource === "local" && selectedDiffRepositoryRoot` 时调用：

```ts
getGitDiffs(workspaceId, selectedDiffRepositoryRoot)
```

返回的 `GitFileDiff[]` 通过现有 `buildCanonicalGitChanges({ files: [], diffs })` 转为 `viewerDiffs`。`activeDiffs/loading/error` 在该状态下选择 scoped state；commit、PR 和 workspace-root local branches保持原逻辑。

effect 使用 cancellation guard。workspace id、repository root 或 mode 变化后，旧 promise result 不得写回。离开 scoped condition 时 state 清空，避免旧 diff 短暂显示。

Alternative：扩展 `useGitDiffs` 接受 repository root。当前 hook 还承担 workspace-root refresh lifecycle；为一次按需 preview 改其公共 contract 会影响更多 caller，故不采用。

### Decision: Reuse explicit-repository discard confirmation

multi-repository unstaged section把当前 group 的全部 paths传为：

```ts
onDiscardFiles(repositoryRoot, paths)
```

`GitDiffPanel` 将其写入 existing target：

```ts
{ scope: "explicit-repository", repositoryRoot, paths }
```

确认后按既有顺序逐个调用 `onRevertRepositoryFile(repositoryRoot, path)`，全部完成后调用一次 aggregate status refresh。staged section不传 callback，因此不显示 discard-all。

### Decision: Diff center owns the content height

`DesktopLayout.shouldShowComposerBelowContent` 增加 `centerMode !== "diff"`。center diff 是 inspection surface，不是 conversation surface；隐藏底部 Composer 避免重复占高。该判断只影响 center diff，不改变 editor/chat split Composer placement。

### Decision: Branch batch actions remain semantically unchanged

multi-repository root view 的 Update All / Checkout All 从 list body `CommandItem` 移到 `composer-git-command-header`：

- 使用既有 `TooltipIconButton`；
- accessible label 继续使用原 i18n keys；
- pending 时 disable，Update 显示 spinner；
- handler、partial failure、checkout discovery 与 refresh 不变；
- repository list 不再被 action row/separator挤占。

## Data Flow

```text
repository group inline action
  -> onOpenInlinePreview(repositoryRoot, path)
  -> GitDiffPanel.onSelectFile(path, repositoryRoot)
  -> AppShell handleSelectDiff(path, repositoryRoot)
  -> selectedDiffPath + selectedDiffRepositoryRoot
  -> getGitDiffs(workspaceId, repositoryRoot)
  -> buildCanonicalGitChanges(...).viewerDiffs
  -> center diff selects path

unstaged group discard-all
  -> onDiscardFiles(repositoryRoot, paths)
  -> explicit-repository confirmation target
  -> sequential scoped revert
  -> one aggregate refresh
```

## State And Error Matrix

| State/input | Diff source | Expected behavior |
|---|---|---|
| local + repositoryRoot | scoped `getGitDiffs` | scoped loading/error/diffs |
| local + no repositoryRoot | existing `gitDiffs` | unchanged single/workspace-root behavior |
| commit | `gitCommitDiffs` | repository scope ignored |
| PR | `prDiffs` | repository scope ignored |
| path cleared | none selected | clear repository root and scoped state |
| workspace changes during request | new workspace state | ignore old completion |
| scoped fetch fails | scoped error | do not fall back to a different repository's diff |
| discard cancelled | no mutation | close dialog only |
| discard confirmed | explicit repository | revert exact paths, then refresh once |

## Test Strategy

- Component：`GitMultiRepositoryChanges` 断言 inline preview 和 discard-all均转发 exact repository identity。
- Controller：补 `useGitPanelController` tests，覆盖 scoped service call、canonical diff selection、loading/error、workspace switch stale completion、scope clear 和 legacy fallback。
- Layout：补 `DesktopLayout` 或 layout node test，断言 diff mode不渲染 bottom Composer，其他 mode不回归。
- Branch UI：断言两个 actions位于 command header、icon-only、可访问且 handler/pending behavior不变。
- Existing Git panel confirmation tests继续覆盖 cancel、sequential revert、refresh 与 submitting guard；缺口处补 explicit batch case。

## Risks / Trade-offs

- **Risk：旧 scoped request 覆盖新 selection。** effect cancellation + dependency identity 防止 stale write；测试 deferred promises。
- **Risk：同 path 在多仓冲突。** repository root存为 selection identity的一部分，禁止 scoped fetch失败后回退 workspace-root list。
- **Risk：repository root在清空 selection后残留。** `selectedDiffPath` 清空 effect与 workspace change effect双重清理。
- **Risk：batch discard部分成功。** 沿用现有 sequential semantics；错误传播保持当前 dialog behavior，不引入 transaction/rollback。
- **Trade-off：每次切换 repository会请求一次 diff。** 按需 I/O 小于全仓预取；本次不加 cache，避免 stale invalidation complexity。

## Rollback

回滚 optional repository prop chain、scoped state、multi-repository batch callbacks和 presentation changes即可。Backend/storage无迁移。回滚后恢复原 workspace-root center diff限制，不影响已有 repository-scoped modal preview和single-file mutations。

## Open Questions

无。工作区代码已选择按需 scoped fetch + existing confirmation/handler reuse。
