# 修复多仓 Git 预览与密度

## OpenSpec Change

`fix-multi-repository-git-preview-density`

## Goal

恢复多 repository changed-file modal preview，并将 repository group 与文件区域密度对齐单仓基线。

## Requirements

- Preview identity 包含 `workspaceId + repositoryRoot + filePath`。
- repository-scoped diff/full diff 复用现有 service contract。
- stale request 不得覆盖最新 repository preview。
- repository header 使用单仓 `26px` row tokens，文件行继续使用共享 renderer。

## Acceptance Criteria

- [ ] 多仓 modal preview 可点击并展示正确 repository diff。
- [ ] same-relative-path 与快速切仓不串仓。
- [ ] 多仓 header、gap、padding 与单仓视觉密度一致。
- [ ] focused tests、typecheck、lint、diff check、OpenSpec strict validation 通过。

## Technical Notes

不新增 backend API 或依赖；实现与验收以 `openspec/changes/fix-multi-repository-git-preview-density/**` 为准。
