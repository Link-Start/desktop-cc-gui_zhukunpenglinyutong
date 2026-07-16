## Why

当前文件树只能打开文件或查看 worktree diff，无法回答“这个文件经历过哪些提交、每次具体改了什么”。现有 Git History 已具备 commit pagination 与 file-scoped diff substrate，但缺少 path-scoped history contract 和独立文件历史工作台，导致用户必须离开当前文件语境手工搜索提交。

## 目标与边界

- 在文件树的 Git submenu 提供“显示历史记录”入口，只对文件目标开放。
- 打开独立 `File History` view：左侧展示触及该文件的 commit list，右侧展示选中 commit 对该文件的 diff。
- 复用现有 `GitHistoryResponse`、`get_git_commit_history` pagination/snapshot contract、`get_git_commit_diff` 与 `GitDiffViewer`。
- `path` 使用 repository-relative normalized path；multi-repository workspace 必须携带精确 `repositoryRoot`。
- Desktop Tauri 与 remote daemon/Web Service 保持 payload 和行为 parity。
- 文件切换、commit 切换、分页与关闭视图时，迟到 response 必须被 request identity guard 丢弃。

## 非目标

- 第一版不提供两个任意历史版本之间的 compare picker。
- 不提供历史版本编辑、checkout、revert、reset 或其他 Git mutation。
- 不把 file blame、line ownership 或 CodeMirror gutter annotation 合并进本能力。
- 不在第一版支持 detached file explorer 跨窗口打开 File History。
- 不持久化最后选中的 file/commit，也不改变通用 Git History panel 的布局。

## What Changes

- 为 `get_git_commit_history` 增加 optional `path` filter，并将 normalized path 纳入 snapshot identity。
- path filter 默认 follow rename，返回值继续使用 `GitHistoryResponse`，未传 `path` 时保持现有行为。
- 同步 Desktop command、remote forwarding、daemon dispatch 与 daemon Git implementation。
- 新增 feature-local `FileHistoryView`，提供 commit list、分页、selected commit diff、loading/error/empty/retry 状态。
- 为文件树增加 optional `onOpenFileHistory` contract，并在文件 Git submenu 中暴露入口。
- 新增 workspace path 到 owning repository + repository-relative path 的 pure resolver 与 focused tests。
- 新增独立 style shard 和 i18n copy；不修改现有 `GitDiffPanel` implementation。

## 方案比较与取舍

1. **推荐：独立 File History view + 扩展现有 history command**。共享 commit/diff DTO 与 backend forwarding contract，同时保持 UI state 与四区 Git History panel 解耦，范围最小且可测试。
2. **给现有 Git History panel 增加 file mode**。可以少建一个入口组件，但会把 file target、path normalization 和异步 diff state继续压入已经超大的 `GitHistoryPanelImpl`，增加回归面，因此拒绝。
3. **Frontend 逐 commit 调用 diff 并自行过滤**。无需 backend contract 改动，但会产生 N+1 IPC、无法稳定分页和 follow rename，remote mode 成本更高，因此拒绝。

## Capabilities

### New Capabilities

- `file-history-view`: 定义文件树入口、独立 commit list + file diff view、状态管理、multi-repository scope 与 stale response contract。

### Modified Capabilities

- `git-commit-history`: 增加 optional path-scoped history、rename-follow、snapshot identity 与 remote backend parity requirement。

## 验收标准

- 用户右键 repository 内文件并选择 `Git -> 显示历史记录` 后，打开以该文件为唯一 scope 的 File History view。
- commit list 只包含触及该文件（包含 rename chain）的 commits，并支持 100 条分页加载。
- 选中 commit 后只请求并展示该文件的 diff；切换 selection 时旧 response 不能覆盖新 selection。
- root repository 与 nested repository 都传递正确的 `repositoryRoot` 和 repository-relative `path`。
- untracked/no-history、non-Git、binary/image、backend error 都有明确状态且不触发 mutation。
- 未传 `path` 的现有 Git History 调用、Desktop local mode 与 remote daemon mode 行为保持不变。
- focused frontend/Rust tests、typecheck 与 runtime contract checks 通过。

## Impact

- Frontend：`src/features/files/**`、`src/features/git-history/**`、AppShell state/layout wiring、`src/services/tauri/git.ts`、i18n、feature style loader/tests。
- Backend：`src-tauri/src/git/commands.rs`、shared Git helpers、`src-tauri/src/bin/cc_gui_daemon.rs`、`src-tauri/src/bin/cc_gui_daemon/git.rs` 与相关 tests。
- API：`get_git_commit_history` 新增 backward-compatible optional `path` field。
- Dependencies：不新增 dependency；复用现有 Git CLI/git2、React Virtual 与 diff rendering substrate。
