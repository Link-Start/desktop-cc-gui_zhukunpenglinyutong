# OpenSpec: add-multi-repository-global-git-actions

## Goal

在 Composer 多 repository Git command center 顶部提供 `更新全部` 与 `切换全部分支…`，使用 explicit repository scope 串行执行，并提供 partial failure 汇总。

## Requirements

- OpenSpec change: `add-multi-repository-global-git-actions`
- 多仓 root view 才显示 global actions；单仓 UI 不变。
- Update 使用各仓 current branch；无 current branch 时 skip。
- Checkout 读取每个 repository 的 branch list，展示至少两个仓库共有的 exact local / remote branch target、覆盖数量和适用仓库。
- repository branch list 获取失败时标明失败仓库，但不阻断其余仓库形成公共分支组。
- 选择公共分支后只切换适用仓库；其他仓库计为 skipped。
- repository icon 使用稳定差异化颜色辅助识别，且不替代名称与 Git status。
- 单仓失败后继续，最终汇总 success/failure/skipped。
- 复用已有 scoped Tauri commands，不新增 dependency/backend batch API。
- 用户已完成手工验收，允许执行提交、OpenSpec archive 与 Trellis record 收口。

## Acceptance Criteria

- [x] 每次 mutation 都携带正确 `repositoryRoot`，包括显式空字符串 root。
- [x] 操作串行、pending 防重入、partial failure 可归因。
- [x] aggregate status 在 batch 结束后刷新。
- [x] focused tests、lint、typecheck、runtime contracts 与 strict OpenSpec validation 通过。
- [x] 用户手工验收 UI 与真实多仓操作。
- [x] 切换全部分支可展示公共本地分支与公共远程分支，并可直接选择执行。
- [x] repository icon 使用稳定差异化颜色，排序变化后保持一致。

## Technical Notes

OpenSpec proposal/design/specs/tasks 是 behavior single source of truth。实现优先复用 `useGitBranches`、`useAppShellGitWorkspaceOpsSection` 与 `ComposerBranchBadge` 的既有 contract。
