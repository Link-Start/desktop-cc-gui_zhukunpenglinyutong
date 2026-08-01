# Git Graph 多文件历史页签

## Goal

将 File History 从主编辑区迁移到 Git Graph integrated title tabs，并支持多个文件历史页签。

## OpenSpec

- Change: `move-file-history-into-git-graph-tabs`

## Requirements

- Git Graph 为固定且不可关闭的首 tab。
- 不同 `workspaceId + repositoryRoot + path` 打开独立 File History tab。
- 重复 target 聚焦已有 tab；关闭 active tab 时右邻、左邻、Git Graph 依次兜底。
- 复用既有 File History query/diff renderer，不修改 backend contract。
- 清理 `centerMode="fileHistory"` 旧路由。

## Acceptance Criteria

- [ ] File Tree 与 Git Diff 入口打开 Git Graph 内对应 File History tab。
- [ ] 多 tab 去重、切换、关闭与 fallback 正确。
- [ ] ARIA tab semantics 与 narrow overflow 可用。
- [ ] File History focused tests、Git History tests、typecheck、lint 通过。

## Technical Notes

实现与验收以 `openspec/changes/archive/2026-07-24-move-file-history-into-git-graph-tabs/**` 为 single source of truth。
