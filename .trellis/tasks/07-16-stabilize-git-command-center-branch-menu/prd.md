# Stabilize Git command center branch menu

## Goal

实现 OpenSpec change `stabilize-git-command-center-branch-menu`：稳定 repository/branch projection、增加一层 branch scope 折叠，并精简文件树 Git submenu、复用现有能力更新点击 repository 的当前分支。

## Requirements

- 以 `openspec/changes/stabilize-git-command-center-branch-menu/**` 为 behavior single source of truth。
- 单次 transient empty summary 不得清空 last-known-good repository selection 与 branch rows。
- Local/Remote scope 独立折叠，搜索临时展开匹配项。
- 删除 Show Diff、Compare Revision、Compare Branch/Tag、Rollback，新增 Update。
- Update 显式传递 `repositoryRoot` 与 `currentBranch`，无可更新分支时禁用。
- 不新增 backend command 或 dependency。

## Acceptance Criteria

- [ ] 分支列表不再因一次 summary 空响应闪空。
- [ ] local/remote 内层 scope 可折叠且搜索行为正确。
- [ ] repository submenu 组成符合确认范围。
- [ ] Update 仅作用于点击 repository，并覆盖 pending/result/error。
- [ ] focused tests、typecheck、lint、runtime contracts、strict OpenSpec validation 通过。

## Technical Notes

- Frontend-only change；复用 `updateGitBranch(workspaceId, branchName, repositoryRoot)`。
- 相关规范：frontend component/hook/state/quality/type-safety 与 guides cross-layer/reuse。
