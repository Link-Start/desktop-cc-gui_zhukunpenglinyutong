## Context

现有 multi-repository discovery 已能返回 `GitRepositorySummary[]`，文件树也能识别各 repository 的 branch/dirty state；但完整 `GitStatusState`、stage/commit/push controller 仍以 configured Git root 为唯一目标。另一个缺陷是 `useGitBranches` 仅在 `selectedRepositoryRoot` 已建立时获得 `workspaceId`，即使调用方传入 `repositoryRootOverride` 也会提前退出。

该变更跨越 React component/hook、Tauri service mapping 与 Rust Git command。设计必须保留 standalone/single repository compatibility，并避免将多 repository status 的高频 state 提升到 AppShell 根链。

## Goals / Non-Goals

**Goals:**

- 用 `workspaceId + repositoryRoot` 作为所有 scoped Git read/write operation 的稳定 identity。
- single repository 继续呈现既有 commit panel；multi repository 才呈现 repository groups。
- multi repository status 可并行加载、部分失败隔离且拒绝 stale response。
- 多 repository selection 可顺序生成独立 commits，并返回 repository-level outcome。

**Non-Goals:**

- 跨 repository atomic commit/rollback。
- 新增 polling cadence、第三方 dependency 或虚构 combined Git repository。
- 为 Git History 复制一套平行 command family。

## Decisions

### Decision 1：复用 optional `repositoryRoot` contract，而不是新增平行 command family

现有 branch commands 已采用 optional `repositoryRoot`。Git status/stage/unstage/revert/commit/push/pull/sync/fetch 沿用同一 contract：omitted 表示 configured root，`""` 表示 workspace root，non-empty 表示 normalized workspace-relative child repository。Rust 统一通过 existing repository resolver 校验边界。

替代方案是新增 `*_repository` commands。其优点是签名显式，但会复制 desktop/daemon mapping 与 error path，增加 contract drift，因此不采用。

### Decision 2：frontend 使用 repository-keyed status model

定义 repository group view model，key 为 normalized `repositoryRoot`，每组保存 summary、full status、loading/error 与 selection。完整 status 仅对 dirty repositories 获取；请求以 workspace generation/token 防止旧 workspace response 覆盖新状态。并发使用已有 promise orchestration，不新增 dependency。

single repository 时把唯一 status 适配为原 `GitDiffPanel` props，不显示 group header；multi repository 时由新 group component 渲染各 repository 的 section/tree，并将 callback 自动绑定 repository identity。

### Decision 3：selection identity 为 repository + section + path

文件 path 在 Git status 内是 repository-relative，不能单独作为 workspace selection key。selection 在 controller 内按 `repositoryRoot` 分桶，每桶继续保留 staged/unstaged semantics。切换 flat/tree view 不改变 selection；repository group collapse 也不清空 selection。

### Decision 4：多仓库 commit 是 deterministic sequential orchestration

提交顺序按 repository display order（workspace root 优先，其余 normalized path lexical order）。每个 repository 独立执行 stage selection、commit，并在 `commit-and-push` 时只 push 该次 commit 成功的 repository。错误被归一化为 `{ repositoryRoot, status, message }`，失败不会阻塞后续 repository；成功组刷新并清空已提交 selection，失败组保留 selection。

选择 sequential 而不是 parallel mutation，因为多个 repositories 可能共享 credential prompt、daemon/workspace lock 与 UI progress surface；顺序执行更可诊断，也避免交错通知。

### Decision 5：更新操作不依赖 selected repository state

`useGitBranches` 始终从 active workspace 获取 `workspaceId`；selected repository 只决定 omitted-root fallback。显式 `repositoryRootOverride` 直接传到 service。这样 context-menu target 与当前 UI selection 解耦。

### Decision 6：Git History 使用独立 repository scope 复用既有 command contract

底部 Git History 保留独立 selected project workspace，并增加 `historyRepositoryRoot`。用户从 repository picker 选择 child repository 时，不创建 child workspace，而是向既有 history/branch/diff commands 传递 optional `repositoryRoot`。Rust command boundary 统一复用 `resolve_git_root_for_scope`，omission 保持 single-repository legacy behavior，显式 child root 则只解析 workspace 内已发现的 Git repository。

若主 active workspace 改变，则 History project 与 repository scope 重置到新的 active workspace。repository summary scan 使用 generation guard，避免旧 workspace response 覆盖新选择。二级选择不得调用 `addWorkspaceFromPath` 或 `setActiveWorkspaceId`，从而不污染一级 workspace/worktree topology。

### Decision 7：single/multi 统一 bottom commit composer

`GitDiffPanel` 的 diff mode 采用 column layout：changed-file surface 是唯一 scroll region，commit composer 位于 DOM 尾部并使用 panel-local sticky/flex footer。single repository 复用现有 `CommitButton` 与 generate-message 行为；multi repository 仅调整现有 group component 的 DOM order，不复制提交逻辑。empty/push-only 状态仍留在 content region，避免空 footer 占位。

### Decision 8：Git History 使用 workspace + repository 两层选择，不替换旧 picker

existing `GitHistoryProjectPicker` 继续负责 workspace/worktree hierarchy。History workspace 变化后，以一次性 repository summary scan 更新第二层 repository picker；不复用主窗口 active workspace 的 summaries，也不新增 polling。第二层只在 `repositories.length > 1` 时显示，repository selection 只更新独立 `repositoryRoot` scope，避免修改主 `setActiveWorkspaceId` 或 workspace catalog。

不采用“自动跟随右侧 Git panel”：multi mode 右侧同时展示多个 repositories，并不存在唯一 active repository，自动推断会产生隐式 target race。

### Decision 9：multi repository AI generation 使用 scoped selection payload

保留 legacy `selectedPaths` 参数，并新增 optional `repositorySelections: Array<{ repositoryRoot, selectedPaths }>`。Rust command boundary 对每个 `repositoryRoot` 复用 `resolve_git_root_for_scope`，分别收集 diff 后带 repository heading 合并为一个 prompt。single mode 不传该字段，行为完全兼容；multi mode 的 engine icon/menu/loading state 复用 `GitDiffPanel` 已有交互，不新增另一套 engine configuration。

## Data Flow

```text
GitRepositorySummary[]
  -> dirty repository roots
  -> scoped getGitStatus(workspaceId, repositoryRoot) in parallel
  -> Map<repositoryRoot, RepositoryGitStatus>
  -> single adapter OR multi group render
  -> repository-keyed selection
  -> sequential scoped stage/commit/(push)
  -> per-repository outcome + targeted refresh

GitRepositorySummary[]
  -> Git History repository picker
  -> update independent historyRepositoryRoot
  -> existing GitHistoryPanel commands + optional repositoryRoot
  -> resolve_git_root_for_scope

RepositoryCommitSelection[]
  -> commit message engine menu
  -> get/generate commit message prompt(repositorySelections)
  -> scoped diff per repositoryRoot
  -> one combined prompt / one generated message
```

## Error Handling

- status 某一 repository 失败：保留该 group 的 error state，其他 groups 正常显示。
- scoped repository 不存在/越界：backend 返回带 action 与 repository context 的 readable error，不 fallback 到 configured root。
- commit partial failure：toast/summary 展示成功数、失败数和 repository name；失败 selection 不丢失。
- push failure：commit 结果保持成功，push 单独标记失败，禁止谎报整体未提交。

## Risks / Trade-offs

- [多 repository status 增加 Git scan 开销] → 只请求 discovered dirty repositories，保持现有 refresh cadence，并并行读取。
- [optional repositoryRoot 被错误 fallback] → Rust resolver tests 覆盖 omitted/empty/nested/escape 四种语义。
- [partial success 让用户误以为原子提交] → UI 明确逐 repository result，不提供全局“全部回滚”措辞。
- [现有 singular controller 文件过大] → 仅抽 repository orchestration hook/pure helpers，避免复制整个 commit controller。
- [当前 worktree 已有 file-tree decoration 修改] → 只在共享文件做局部 semantic patch，不覆盖或回退既有改动。

## Migration Plan

1. 先扩展 backend/service optional payload 与 contract tests，确保 omitted legacy path 不变。
2. 修复 scoped branch update guard。
3. 引入 repository-keyed read model 和 adaptive single/multi render。
4. 引入 sequential mutation orchestration 与 outcome UI。
5. 运行 focused tests、typecheck、runtime contract、Rust tests 与 strict OpenSpec validation。

Rollback 时可以移除 multi orchestration/render；optional `repositoryRoot` 保持向后兼容，不需要数据迁移。

## Open Questions

无。用户已确认多 repository 使用相同 message、分别创建 commits，并要求明确区分 single/multi 形态。
