## Why

客户端当前分别在 `GitDiffPanel`、`GitHistoryWorktreePanel` 与 `GitHistoryPanelView` 维护 changed-file flat/tree renderer 和 preview wiring。三套视觉近似但 interaction contract 不同，已经造成入口定位错误、旧新弹窗并存与修复漂移，因此必须先统一文件列表核心，再统一预览链路。

## 目标与边界

- 将 worktree 与 commit changed-file 的 row、folder topology、flat/tree rendering 和 preview command 收敛到同一套 feature-local shared components。
- 页面容器继续拥有各自的数据加载、selection 与 Git mutation orchestration，通过明确 adapter/actions 注入共享 renderer。
- 三个可点击 changed-file surface 全部复用现有 `WorkspaceEditableDiffReviewSurface` 新预览体验。
- 恢复此前误断开的主界面 Source Control preview wiring，并移除迁移完成后的 legacy modal renderer/state。

## 非目标

- 不修改 Rust/Tauri Git command、backend payload 或 diff patch 格式。
- 不合并 `GitDiffPanel` 与 `GitHistoryPanelView` 页面布局。
- 不改变 stage、unstage、discard、commit inclusion 与 commit selection 的业务语义。
- 不引入新的 diff engine 或第三方依赖。

## What Changes

- 新增 canonical changed-file view model 与现有 domain model adapters。
- 抽取 shared flat/tree topology、folder row、file row 与 list renderer。
- 迁移 `GitDiffPanel`、`GitHistoryWorktreePanel`、`GitHistoryPanelView` 到共享 renderer。
- 统一 preview command 与 modal host，全部渲染现有 editable workspace diff review surface。
- 删除被替代的 legacy `GitDiffViewer` modal branches 和重复 preview state。

## 方案对比

- **方案 A：共享 renderer + domain adapters（采用）**。保留页面 orchestration，只统一重复 UI/interaction core；依赖方向清晰，迁移可分阶段验证。
- **方案 B：让 Git History 直接复用整个 `GitDiffPanel`（不采用）**。能减少表面 JSX，但会把 worktree mutations、commit history data、panel mode 与 layout props 混成巨型 API，形成更强耦合。
- **方案 C：仅统一 CSS 和 popup callback（不采用）**。无法消除 tree topology、keyboard、selection 与 action drift，仍会重复发生入口误判。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `git-panel-diff-view`: changed-file flat/tree surfaces SHALL 使用 canonical shared renderer contract。
- `git-history-panel`: worktree 与 commit details changed-file surfaces SHALL 复用同一 renderer contract，并保留各自 domain actions。
- `editable-workspace-diff-review-surface`: 所有 Git changed-file modal entrypoints SHALL 接入同一 editable preview surface，不再回退 legacy modal body。

## 验收标准

- 三个区域的 file/folder rows 来自同一 shared renderer module，页面文件中不再存在等价 row/tree JSX。
- flat/tree、keyboard activation、folder collapse 与 active/selected semantics 在三个入口保持一致。
- 主界面 Source Control、Git 全屏页 worktree、Git 全屏页 commit details 均打开同一种新预览弹窗。
- stage/unstage/discard/inclusion 与 commit detail read-only 行为保持原 contract。
- focused Vitest、`npm run typecheck`、lint、large-file gate、`git diff --check` 与 strict OpenSpec validation 通过。

## Impact

- Frontend：`src/features/git/components/**`、`src/features/git-history/components/**` 与对应 tests/styles。
- Behavior：changed-file list rendering、selection/activation 与 modal preview entrypoints。
- API/backend/dependencies：无变化。
