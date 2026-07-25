# Remove Generated Worktree Branch Default

## Goal

实现 OpenSpec change `remove-generated-worktree-branch-default`：Create Worktree dialog 的 branch 默认留空，由用户显式填写。

## Requirements

- 复用现有 required/Git ref validation
- 保持 baseRef、publish、setupScript 和 backend payload 不变
- 不新增 purpose 字段或 slug generator

## Acceptance Criteria

- [ ] 打开和重新打开 dialog 时 branch 为空
- [ ] 空 branch 无法提交，合法 branch 原流程不变
- [ ] Focused tests、lint、typecheck、OpenSpec strict validation 通过

## Technical Notes

唯一关联 OpenSpec change：`remove-generated-worktree-branch-default`。
