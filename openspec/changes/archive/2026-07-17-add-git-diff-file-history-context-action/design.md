## Context

File History 已经具备完整的 path-scoped backend、`FileHistoryTarget`、center workspace 与 FileTree entry。Git Diff changed-file menu 刚统一为 shared `buildGitDiffPanelFileContextMenuItems`，single/multi row 都能提供 exact section/repository mutation scope，但它尚未接收 AppShell 的 `onOpenFileHistory` capability。

本变更只补 adapter/wiring：Git Diff row 是 repository/file identity owner，layout 是 File History navigation owner，shared menu builder 只负责 presentation/order。当前工作区存在上一轮未提交的 menu/collapse change，必须逐段叠加，禁止整文件覆盖。

## Goals / Non-Goals

**Goals:**

- single flat/tree 与 multi grouped row 使用同一个 `Git -> 显示文件历史` action。
- target 精确包含 `workspaceId/workspacePath/repositoryRoot/path/displayPath`。
- History 与 bulk mutation selection 解耦；read-only capability 不被 `mutationDisabled` 误伤。
- callback/topology/workspace 变化后 stale menu 不可继续激活。
- 保持现有 File History、Stage/Unstage/Discard command path 不变。

**Non-Goals:**

- 不新增 history query、backend command、daemon mapping 或 history UI。
- 不为多个 selected files 打开多个 history workspace。
- 不改变 mutation ordering、confirmation、refresh 或 selection state。
- 不处理 repository-level/history panel menu。

## Decisions

### 1. 复用 typed navigation callback

`GitDiffPanelProps` 增加 optional `onOpenFileHistory?: (target: FileHistoryTarget) => void`，`useLayoutNodes` 直接透传现有 callback。row handler 在用户激活 menu item 时才调用 callback。

Alternative：dispatch global custom event。拒绝，因为它丢失 compile-time target contract，并让 row/menu 生命周期与 AppShell global listener 耦合。

### 2. Row owner 构造 exact target，menu builder 只接收 action

新增 pure target resolver，输入 workspace、single `gitRoot` 或 multi explicit `repositoryRoot`、repository-relative row path，输出 `FileHistoryTarget | null`：

```ts
resolveGitDiffFileHistoryTarget({
  workspaceId,
  workspacePath,
  gitRoot?,
  repositoryRoot?,
  path,
}): FileHistoryTarget | null
```

- `repositoryRoot !== undefined` 表示 multi explicit identity，`""` 必须原样保留。
- single `gitRoot` absent/empty/`.` 或等于 workspace root 时映射为 `""`。
- nested root 使用 `resolveGitRootWorkspacePrefix` 规范化为 workspace-relative root。
- invalid/absolute-escaping root、empty/traversal path 返回 `null`。
- `displayPath` 使用 normalized repository root prefix + repository-relative path。

Alternative：让 layout 根据 clicked path 反查 repository。拒绝，因为 layout 不拥有 clicked section/status row，multi same-path 容易重新引入 path-only ambiguity。

### 3. History 始终绑定 clicked file

single bulk selection 继续只生成 Stage/Unstage/Discard `targetPaths`。History action 捕获 `clickedFile.path` 与 clicked row repository，不读取 `selectedFiles`。multi 当前是 single-row mutation，也保持 exact row。

Alternative：selected rows 数量大于一时隐藏 History。拒绝，因为右键 anchor 已经提供明确单文件 target，隐藏会造成无必要的不一致。

### 4. Read-only availability 与 mutation availability 分离

`isFileMutationDisabled(file)` 只控制 Stage/Unstage/Discard。只要 row、workspace、repository scope、callback 有效，diff-only/mutation-disabled row 仍能展示 History。shared builder 在只有 `historyAction` 时仍返回 root `Git` submenu；所有 action 都缺失才返回 `[]`。

Menu ordering 固定为：

1. Unstage 或 Stage
2. 显示文件历史
3. separator（仅当 Discard 前已有 item）
4. Discard（danger，始终最后）

### 5. Stale invalidation 覆盖 read-only callback identity

现有 file-menu invalidation effects 追加 `workspacePath` 与 `onOpenFileHistory` dependency。single 继续观察 `gitRoot/files/mutation callbacks`，multi 继续观察 `repositoryStatuses/loading/scoped callbacks`。只关闭 `source === "git-diff-file"` 的 menu，不影响 log/PR 右键菜单。

## Validation and Error Matrix

| Case | Expected |
|---|---|
| single root, `gitRoot=null/""/workspacePath` | `repositoryRoot=""`, normalized clicked path |
| single nested absolute/relative root | workspace-relative root + repository-relative path |
| multi `repositoryRoot=""` | empty root preserved |
| same path in two multi groups | clicked group root wins |
| multi-select single mode | History target is clicked file only |
| mutation-disabled valid row | History only; no mutation item |
| missing callback/workspace/invalid root/path | no History dead entry |
| workspace/topology/callback changes | open file menu closes |

## Risks / Trade-offs

- [Risk] single root has three equivalent representations (`null`、`""`、workspace absolute path) → pure resolver collapses all to explicit `""` and tests each form.
- [Risk] History accidentally inherits bulk selection → builder receives a callback created from clicked target, never a count/selected path collection.
- [Risk] enabling History on mutation-disabled row conflicts with old early return → availability is split before builder and a dedicated regression test locks the read-only behavior.
- [Risk] existing dirty worktree changes overlap the same panel → edits use focused hunks, inspect diff after each phase, and never use reset/checkout/whole-file replacement.

## Migration Plan

1. Extend spec/task and optional prop contract.
2. Add pure target resolver and shared builder action.
3. Wire single/multi handlers and layout callback.
4. Add focused helper/panel/layout tests.
5. Run quality gates, sync main specs, archive change/task.

Rollback only removes the optional prop, target resolver invocation and history action. Existing FileTree entry, File History backend/view and mutation actions remain intact.

## Open Questions

无。用户已确认 History 只作用于 clicked row，且 danger action 保持最后。
