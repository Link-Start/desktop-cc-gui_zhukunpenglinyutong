## Context

现有 Git substrate 已包含 `list_git_roots`、rich `list_git_branches`、Git Diff/History write workflows 与 remote daemon forwarding，但这些能力围绕 persisted `WorkspaceSettings.gitRoot` 组织。Composer 只消费 legacy `BranchInfo[]`，文件树只拿 active root 的 `GitStatusState`，因此 nested repositories 没有稳定 identity，也没有可共享的 repository state。

约束包括：Tauri local/remote parity、Windows/Unix path separator、AppShell render baseline、单文件 3000 行门禁、无新增依赖，以及 Git write action 必须有清晰 target 与 error propagation。

## Goals / Non-Goals

**Goals:**

- 建立 bounded `Workspace -> GitRepositorySummary[]` read model。
- repository identity 使用 workspace-relative POSIX-style path；workspace root 使用空字符串 `""`。
- 文件树与 command center 共享 summary state，不重复扫描。
- branch direct mutations 使用显式 repository scope；Commit/Push 复用现有完整 workflow，并在打开 workflow 前显式切换可见 Git context。
- partial failure、stale response、remote daemon 与 keyboard/a11y 可验证。

**Non-Goals:**

- 不提供跨 repository transaction/batch mutation。
- 不让 aggregate summary 携带完整 file list 或 commit history。
- 不新增 repository cache daemon 或 filesystem watcher。

## Decisions

### Decision: 单次 aggregate summary command

新增：

```text
list_git_repository_summaries(workspaceId: string, depth?: number)
  -> GitRepositorySummary[]
```

`GitRepositorySummary` contract：

```text
repositoryRoot: string          // "" 表示 workspace root；其余为 normalized relative path
displayName: string
currentBranch: string | null
headState: "branch" | "detached" | "unborn" | "unavailable"
upstream: string | null
ahead: number
behind: number
stagedCount: number
modifiedCount: number
untrackedCount: number
conflictedCount: number
isClean: boolean
error: string | null
```

Backend 先检查 root marker，再复用 bounded nested scan；逐 repository 打开与读取，单个失败转换为 row-local `error`。aggregate response 不返回 files，避免 bridge payload 随仓库规模失控。

替代方案是 frontend `list_git_roots` 后 N 次调用 status/branch commands。该方案增加 IPC、race 与 partial failure 编排，拒绝。

### Decision: repository scope 不隐式借用 persisted gitRoot

branch read/direct mutation command 增加 optional `repositoryRoot`：

```text
list_git_branches(workspaceId, repositoryRoot?)
checkout_git_branch(workspaceId, name, repositoryRoot?)
create_git_branch(workspaceId, name, repositoryRoot?)
update_git_branch(workspaceId, branchName, repositoryRoot?)
```

`None/undefined` 保持现有 `WorkspaceSettings.gitRoot` behavior；显式 `""` 表示 workspace root；非空值必须是 workspace-relative path。Backend validator 拒绝 absolute path、parent traversal、workspace escape 与 missing Git marker。

Commit/Push 不在 compact command center 重建复杂 dialog：action 先通过现有 `onSelectGitRoot` 更新用户可见 Git context，await 完成后打开现有 Git Diff/History workflow，并通过 one-shot requested action 打开对应 surface/dialog。用户在真正写入前能看到目标 repository。

### Decision: shared frontend controller，UI 只消费 view model

新增 feature-local repository controller 负责：

- load/dedupe/stale-result rejection；
- `Map<repositoryRoot, GitRepositorySummary>`；
- mutation 后 refresh；
- visible/connected guard；
- event-driven refresh + `>=30s` fallback。

`FileTreePanel` 只接收 stable summary array/map，精确匹配 folder path；`ComposerBranchBadge` 根据 summary count 渲染单/多仓库层级。普通 `folderGitStatusMap` 继续只表达 descendant file change，不承担 repository identity。

### Decision: branch hierarchy 复用 rich backend payload

扩展 `normalizeGitBranchListResponse` 保留 `localBranches`、`remoteBranches`、`currentBranch`。recent branch 从 local branch `lastCommit` 排序派生；local/remote path segments 只作为 UI grouping，不参与 filesystem path。

### Decision: Update feedback 与 branch section 使用显式 view state

`ComposerBranchBadge` 对每个 action 使用 keyed pending state，Update 在请求期间展示 spinner 并阻止重复提交。`GitBranchUpdateResult` 必须从 hook/AppShell 透传到 command center，由 UI 映射 `success`、`no-op`、`blocked` 与 error；不得把返回结果吞成 `void`。Recent branches 是 local metadata 派生的快捷区，Local branches 是完整集合，两者允许出现同一 branch，但必须分别标为 Recent/Local，remote sections 独立标为 Remote。

### Decision: 文件树 Git submenu 只发出 repository-scoped action intent

`FileTreePanel` 只在 folder path 精确命中 repository summary 时构造 Git submenu。菜单不复制 Git History/Diff 的 write state machine，而是发出 typed `{ repositoryRoot, action }` intent：AppShell 先 await 现有 Git root selection，再将安全 direct action 或 one-shot navigation action交给现有 Git surface。需要参数、预览或可能破坏数据的 Commit/Push/Pull/Merge/Rebase/Reset/Rollback/Stash 等操作必须进入既有确认 surface；普通文件夹不显示 Git submenu。Clone 是 workspace-level action，仍通过相同菜单入口进入现有 clone workflow，不把当前 folder 错当 clone target。

增量收口后，context menu 只暴露当前验收需要的 11 个 repository actions：Commit、Add/Stage All、Add to `.gitignore`、Show Diff、Compare Revision、Compare Branch/Tag、History、Rollback、Push、Pull、Fetch。standalone root repository 复用 `repositoryRoot=""` contract，从 root label 的 `contextmenu` 进入同一 builder。flyout 使用 trigger rect 与实际/估算宽高选择左右方向，并 clamp 到 viewport，避免固定宽度估算造成左侧间距过大。

### Decision: repository 切换与 branch section 使用局部交互状态

repository row click 设置 `switchingRepositoryRoot`，立即渲染 spinner、禁用所有 repository rows，并 await `onSelectRepository`。只有切换 promise 完成后才进入 branch detail；失败保留 repository list 并显示错误。Recent/Local/Remote 使用独立 collapsed state，菜单每次打开默认全部折叠；非空搜索作为临时展开信号，不覆盖用户折叠偏好。

### Decision: nested repository diff preview 绑定 repository context

repository-scoped Show Diff/Commit/Rollback intent 必须先 await root selection，再打开 Git Diff surface。preview loader 只消费当前 selected Git root 返回的 changed-file path；跨层 path 始终保持 workspace-relative POSIX identity，并在进入 repository-scoped backend command 前转换为 repository-relative path。每次 preview load 使用 request token/stale rejection，并在 success/error/finally 三条路径结束 loading。

### Decision: cross-platform path contract

- IPC repository roots 始终输出 `/` separator。
- Backend 输入同时接受 `/` 与 `\\`，normalize 后按 path components 校验。
- 禁止 absolute/root/prefix/`..` components；canonicalized candidate 必须位于 canonicalized workspace root。
- `.git` directory 与 worktree `.git` file 都视为 marker。
- display name 从 `Path::file_name` 获取，不用字符串 split。

## Error / Validation Matrix

| 输入/状态 | Backend | UI |
|---|---|---|
| `repositoryRoot` omitted | 复用 persisted `gitRoot` | legacy single-root compatibility |
| `repositoryRoot=""` | workspace root | root repository row |
| `a/b` / `a\\b` | normalize 后验证 | canonical repository key |
| absolute / `../escape` | `Err`，不执行 Git mutation | target row error/toast |
| missing `.git` marker | `Err` or unavailable summary | 单 row degraded |
| corrupt/permission denied repo | aggregate 保留其他 rows | 对应 row unavailable |
| stale workspace response | backend 正常返回 | controller 丢弃旧 response |
| remote daemon mode | forward 相同 fields | 与 local mode 相同 rendering |
| Update pending | command 正常执行 | spinner + disabled，拒绝重复提交 |
| Update no-op/blocked | structured result | inline/toast 显示明确原因 |
| ordinary folder context menu | 无 Git mutation | 不显示 Git submenu |
| exact repository context menu | scoped target | 先选择 repository，再执行/导航 |
| repository switch pending | await selected root + branch load | row spinner + duplicate guard |
| standalone root context menu | `repositoryRoot=""` | root label 暴露相同 Git submenu |
| nested diff stale/error | request token / explicit error | 丢弃 stale，结束 loading 并显示错误 |

## Good / Base / Bad Cases

- Good：`checkout_git_branch(workspaceId, name, "services/api")` 只打开并修改该 repository。
- Good：一个 repository 打开失败时 aggregate response 仍包含其他 summaries。
- Base：不传 `repositoryRoot` 的旧调用继续使用 configured `gitRoot`。
- Bad：点击 repository row 立即改 persisted `gitRoot`，随后并发 branch request 命中错误 repository。
- Bad：把 nested repository summary 合并进 parent `gitStatus.files`。
- Bad：frontend 对每个 repository 并发调用 status + branch 两个 commands。

## Risks / Trade-offs

- [大量 repositories 的 libgit2 status 读取耗时] → scan depth clamp、200 个上限、skip directories、aggregate slim payload、低频 refresh。
- [persisted Git context 切换与 surface navigation 竞态] → Commit/Push action 必须 await `onSelectGitRoot` 后再导航/触发 one-shot action。
- [desktop 与 daemon duplicated implementations drift] → shared helper/contract tests + runtime contract check，forward payload 显式包含 repositoryRoot。
- [branch switch 后 summary 短暂 stale] → mutation success 后立即 refresh；旧 request 使用 sequence id 丢弃。
- [UI 过宽] → summary 使用 compact token、ellipsis 与 tooltip；narrow width 不换行破坏 tree hierarchy。

## Migration Plan

1. 先增加 additive types/command 与 optional args，保留旧 callers。
2. 接入 shared repository controller 与 file tree decoration。
3. 升级 command center，并逐项接入 direct actions/navigation actions。
4. focused tests 后运行全量 gates。

Rollback 时可移除新 controller/UI wiring；optional backend args 与 aggregate read command 为 additive，不改变旧 Git surfaces。用户要求本次不提交，因此不执行 archive/sync/commit。

## Open Questions

- 无阻塞问题。默认 scan depth 沿用 2，UI 后续可复用现有 depth setting 扩大到最多 6。
