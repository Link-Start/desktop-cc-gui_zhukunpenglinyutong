# 统一 Git Diff 文件右键菜单

## Goal

实现 OpenSpec change `unify-git-diff-file-context-menu-actions`：让 single-repository flat/tree 与 multi-repository grouped Diff changed-file rows 使用统一 `Git` context submenu，并保持 repository/section mutation scope。

## Requirements

- staged row 仅提供 Unstage。
- unstaged row 提供 Stage 与经过确认的 Discard。
- multi-repository callback 显式传递 `repositoryRoot + path + section`。
- `repositoryRoot === ""` 必须保留，same-path repositories 不得串仓。
- diff-only / `mutationDisabled` row 不暴露 mutation。
- 菜单使用现有 `RendererContextMenu`、i18n、refresh 与 discard dialog。
- 不增加 History、Blame、repository-level command、backend API 或 dependency。

## Acceptance Criteria

- [x] single-repository flat/tree 与 multi-repository grouped rows 右键均阻止 WebView native context menu。
- [x] 根菜单显示 `Git` submenu，action matrix 与 clicked section 一致。
- [x] single same-section bulk selection 保持可用且不跨 section。
- [x] multi same-path 与 explicit empty root 的 mutation scope 精确。
- [x] menu open/dismiss 不触发 file open、commit inclusion 变更、collapse、refresh 或 mutation；保留既有 row selection 语义。
- [x] focused Vitest、lint、typecheck、large-file gate、OpenSpec strict validation 通过。

## Technical Notes

- Behavior source of truth: `openspec/changes/unify-git-diff-file-context-menu-actions/**`
- Reuse `RendererContextMenu`; keep `GitDiffPanel` as the only menu/dialog host.
- Add a feature-local pure menu builder instead of growing duplicated JSX/state.
- Existing uncommitted changes from the previous Git Diff fix are in scope-preserved workspace state and must not be overwritten.
