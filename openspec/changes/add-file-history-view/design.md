## Context

现有 Git substrate 已分成三段：`get_git_commit_history` 返回 pageable commit metadata，`get_git_commit_diff` 支持 optional `path`，`GitDiffViewer` 负责 read-only diff rendering。缺口位于 history query：当前 command 只能按 branch/query/author/date 过滤，FileTree 也只会向 repository-level action bus 发送 `repositoryRoot`，没有 file target contract。

本变更跨越 FileTree、AppShell、frontend service、Tauri command、remote forwarding 和 daemon implementation。当前 `GitHistoryPanelImpl` 体积大且带 `@ts-nocheck`，不能作为新增 file-scoped state 的承载点。工作区同时存在对 `GitDiffPanel` 与 `diff.css` 的未提交修改，因此 MVP 必须通过 public diff surface 与独立 style shard 避免耦合。

## Goals / Non-Goals

**Goals:**

- 提供 file-scoped commit history + selected commit diff 的独立 view。
- 让 path filtering、pagination、snapshot 和 rename-follow 在 backend 一次完成，避免 N+1 IPC。
- 保持 Desktop local、remote daemon、root repository 与 nested repository parity。
- 将 path resolution 和 async stale guards 设计为可独立测试的边界。

**Non-Goals:**

- 不重构 `GitHistoryPanelImpl`，不改变通用 Git History 的四区 layout。
- 不增加 Git mutation、arbitrary revision compare、blame 或 persistent view state。
- 不新增 dependency，不修改当前 dirty `GitDiffPanel` / `diff.css` implementation。

## Decisions

### 1. 扩展现有 history command，而不是新增 command/DTO

`get_git_commit_history` 增加 optional `path`。Frontend 继续消费 `GitHistoryResponse`，pagination、snapshot、commit row model 和 error mapping 保持一致。未传 path 的 call sites 不变。

Alternative：新增 `get_git_file_history`。它会复制 response、forwarding registry、daemon dispatch 与 tests，只有命名不同，没有独立 domain value，因此拒绝。

### 2. Backend 使用 Git `log --follow` 产生 file commit OID sequence

file history 是 Git 原生语义。Backend 通过受控 argument vector 执行 `git log --follow --format=%H <ref> -- <path>`，只解析 full OID lines，再由 `git2` 构造现有 `GitHistoryCommit`。这样复用 Git rename simplification，避免手写 tree traversal 和 rename similarity heuristic。

Path 先执行 existing normalize/validation，禁止 absolute path、`..` 与 repository escape。Branch/ref 继续由现有 resolution contract约束。通用 history 未传 path 时仍走当前 revwalk，不承担 subprocess cost。

Alternative：对 revwalk 中每个 commit 做 full-tree diff + `find_similar`。这会放大大仓 CPU/IO，且 merge/rename semantics 容易偏离 Git，因此拒绝。

### 3. Owning repository resolution 是 frontend pure boundary

FileTree 已拥有 workspace-relative path 与 `GitRepositorySummary[]`。新增 pure resolver：normalize separators，选择包含目标文件的最长 `repositoryRoot`，并剥离 prefix 得到 repository-relative path。根仓库 `repositoryRoot=""` 是 fallback；没有 matching repository 时不展示入口。

该 contract 只负责 routing，不依赖当前 worktree status，因此 tracked、untracked 与 deleted path 的最终 truth 由 backend empty/error response 决定。

### 4. File History 是独立 view state，不进入 GitHistoryPanelImpl

AppShell 保存 nullable `FileHistoryTarget`：`workspaceId/workspacePath/repositoryRoot/path/displayPath`。打开 target 时切换到 File History surface；关闭时返回普通 workspace surface。组件内部管理 commits、snapshot、selected SHA、diff、loading/error 和 request generation refs。

左列使用现有 `@tanstack/react-virtual`；首次请求 100 条，近底部按 snapshot 加载。首次成功自动选择第一条。右列调用 `getGitCommitDiff(..., { path, repositoryRoot })`；text entry 交给 shared `WorkspaceReadOnlyDiffCompare`，复用“上个版本 / 源代码”的 aligned CodeMirror compare，image entry 保留 shared `GitDiffViewer` 的 image renderer。每次 target/selection 变化递增 generation，迟到结果直接丢弃。

### 5. 入口保持 optional，避免 detached explorer 假支持

`FileTreePanel` 新增 optional `onOpenFileHistory(target)`。只有 callback 存在、目标是 file、且 resolver 找到 repository 时，Git submenu 才展示 File History item。Main AppShell 传 callback；detached explorer 第一版不传，因此不会出现不可完成的入口。

### 6. Layout 由 File History container 决定，不由 viewport 猜测

File History 可能同时被 left/right panel 挤压，viewport media query 无法代表实际可用宽度。根节点使用 named CSS container；宽屏时 commit rail 用 bounded `clamp()`，diff 占满剩余空间；窄 container 切成上下布局。File History scope 内覆盖 shared compare 的固定 column minimum，让两个 read-only CodeMirror pane 等分可用宽度，长行仍由 pane 自己滚动。

Alternative：继续增加 viewport breakpoints。它在 right panel 展开、window split 或 future embedded host 中会误判，因此拒绝。

### 7. Read-only 只关闭 mutation，不降级 renderer

`WorkspaceReadOnlyDiffCompare` 的 previous/source column 必须继续走 `FileCodeMirrorEditor`，仅通过 `editable=false` 禁止修改。`readOnlyReason` 只用于真正需要 plain-text fallback 的 unsupported/truncated/error state，不得作为普通 read-only compare 的标记。

Aligned compare 复用现有 `changedLineNumbersByColumn`，通过 column-level semantic tone 区分 previous deletion（red）与 source addition（green）；不扩展 backend DTO，也不复制 diff parser。只读 difference navigation 仍允许 programmatic selection/scroll，因为 navigation 不是 mutation。

Alternative：给 `<pre>` 增加背景色。它没有 aligned gaps、line decorations、syntax highlighting 或 navigation target，无法满足图 3 contract，因此拒绝。

### 8. File identity 必须绑定 commit-time path

`git log --follow` 不仅负责返回 commit OID，也必须返回该 commit 对应的
repository-relative historical path。`GitHistoryCommit.filePath` 使用 optional field 保持
repository-wide history backward compatibility；File History 选择 commit 后以
`selectedCommit.filePath ?? target.path` 请求 diff，并且只接受 exact-path response。

历史 compare 的 CodeMirror gutter 复用 `parseDiff()` 已有 `oldLine/newLine`，通过 optional
line-number labels 显示 unified patch 的真实 source coordinates。该能力只改变 gutter label，
不插入大量 padding lines，也不要求 backend 返回 full-context patch。

Desktop 与 daemon 的 image/binary mapping 复用 shared Git helper：image extension 命中时返回
`isImage=true` 与 old/new blob payload；普通 binary 显示明确 binary state。禁止 daemon 将所有
binary 都降级为 generic unavailable。

Alternative：diff 为空后请求整个 commit 并取第一项。一个 commit 可以修改多个文件，该方案会把
unrelated file 渲染到当前 File History，因此拒绝。

## Data Flow

```text
FileTree file context menu
  -> resolveFileGitScope(workspaceRelativePath, repositories)
  -> AppShell FileHistoryTarget
  -> FileHistoryView
       -> getGitCommitHistory({ path, repositoryRoot, offset, snapshotId })
       -> select commit
       -> getGitCommitDiff({ sha, path, repositoryRoot })
       -> text: WorkspaceReadOnlyDiffCompare
       -> image: GitDiffViewer image renderer

Desktop command
  -> local Git log --follow / git2 mapping
  -> or remote forwarding
       -> daemon dispatch
       -> daemon Git log --follow / git2 mapping
```

## Validation & Error Matrix

| 场景 | 必须行为 | 禁止行为 |
|---|---|---|
| root repository file | `repositoryRoot=""`，path 保持 workspace relative | 把空 root 当作 missing scope |
| nested repository file | longest root match，path 剥离 nested prefix | 把 workspace-relative path 直接传给 nested repo |
| untracked/no history | commit list empty state | 请求所有 repository history |
| rapid file switch | old history/diff response dropped | file A response render 到 file B |
| rapid commit switch | only latest diff renders | stale diff overwrite current selection |
| rename chain | history includes pre-rename commits | 只显示当前文件名之后的 commits |
| pre-rename commit selection | query diff with commit-time historical path | 用 current path 得到 empty diff，或 fallback 到 unrelated file |
| invalid/escaping path | explicit error | Git command 接受 absolute/`..` path |
| remote mode | exact path/root forwarding | fallback 到 desktop local repository |
| no `path` supplied | existing Git History unchanged | 通用 history 执行 file log subprocess |
| wide File History container | bounded commit rail + diff fills remainder | diff 内容只占左半块并留下无意义空白 |
| narrow File History container | commit list stacks above full-width compare | 继续挤压 two-pane compare 或依赖 viewport width |
| selected text diff | aligned read-only previous/source CodeMirror panes | 新建 renderer 或允许修改历史内容 |
| read-only text diff | CodeMirror renders with `editable=false` | `readOnlyReason` 触发 `<pre>` fallback |
| changed lines | previous red deletion / source green addition | 两栏都使用无语义的 blue modified tone |
| patch starts below line 1 | gutter preserves parsed old/new line numbers | compact source 从 1 重新编号 |
| remote image commit | daemon returns image payload parity | `isImage=false` + generic unavailable |

## Risks / Trade-offs

- [Git `--follow` 对 merge history 有原生 simplification 语义，不等于展示每个 merge parent] → MVP 明确采用 Git CLI truth，并以真实 rename fixture 锁定行为。
- [大文件历史仍可能包含大量 commits] → backend 只返回 metadata page；diff 按 selection 单独加载，列表 virtualized。
- [AppShell 新增 surface state 可能与 Git History / editor mode 竞争] → 使用单一 nullable target 和集中 open/close handler，目标切换时显式关闭互斥 surface。
- [当前工作区存在 shared diff dirty changes] → 只 import public `GitDiffViewer`，新增 feature CSS，不编辑 dirty diff files。

## Migration Plan

1. 以 optional `path` 扩展 service/command/daemon contract，并先完成 backend parity tests。
2. 增加 pure repository scope resolver 与 FileTree optional callback。
3. 增加独立 File History surface 和 focused UI tests。
4. 验证不传 path 的 Git History regression、runtime contracts 与 typecheck。

Rollback 时删除 File History target/view/entry，并移除 optional path forwarding；现有 command callers 与 response schema没有破坏性迁移。

## Open Questions

- 第一版人工验收后，再决定是否把同一入口扩展到 FileView tab context menu 或 CodeMirror editor context menu。
- detached explorer 是否通过跨窗口 event 请求 main window 打开历史，留待后续 capability。
