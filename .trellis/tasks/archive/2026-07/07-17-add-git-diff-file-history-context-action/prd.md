# Add Git Diff File History Context Action

## OpenSpec

- Change: `add-git-diff-file-history-context-action`
- Behavior SSOT: `openspec/changes/archive/2026-07-17-add-git-diff-file-history-context-action/**`

## Goal

在 Git Diff changed-file 的统一 `Git` 右键子菜单中接入现有 File History，覆盖 single/multi repository 并保持 exact repository/file identity。

## Requirements

- 复用 `onOpenFileHistory(FileHistoryTarget)`，不新增 backend command。
- History 只作用于 clicked row；bulk selection 不改变 history target。
- root repository 保留 `repositoryRoot=""`，nested repository 使用 workspace-relative root。
- mutation-disabled/diff-only row 只禁 mutation；合法时仍允许 read-only history。
- callback、workspace 或 repository scope 缺失时不展示 dead action。
- workspace/topology/callback 变化时关闭 stale file context menu。

## Acceptance Criteria

- [x] single flat/tree staged/unstaged row 可打开 exact File History target。
- [x] multi same-path repository scope 不串仓，empty root 原样保留。
- [x] multi-select History 只绑定 clicked row。
- [x] disabled/missing-capability matrix 与 spec 一致。
- [x] focused tests、lint、typecheck、OpenSpec strict validation 通过。

## Technical Notes

- 扩展现有 `buildGitDiffPanelFileContextMenuItems`，禁止复制 single/multi menu builder。
- File History target mapping 位于 row owner/orchestrator；shared renderer menu 只消费 action callback。
- 保留上一轮未提交的 unified context-menu 与 collapse changes，不做整文件覆盖。
