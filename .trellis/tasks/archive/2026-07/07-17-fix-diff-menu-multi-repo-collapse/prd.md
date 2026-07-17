# 修复 Diff 菜单与多仓库分组折叠

## Goal

关联 OpenSpec change：`hide-diff-repository-switch-and-fix-multi-repo-collapse`。

隐藏 Diff mode menu 中的仓库切换入口，并让多仓库 staged/unstaged 分组折叠真实可用。

## Requirements

- 只隐藏 Diff 菜单里的 `Switch Git repository`，保留底层 scan/select/clear 与 selector panel contract。
- 折叠状态按 `workspaceId + repositoryRoot + section` 隔离，限定为组件本地 presentation state。
- 折叠不得改变 commit selection，不得触发 stage/unstage/discard/refresh/file-open。
- 不修改 backend、Tauri command、持久化数据与其他 Git surfaces。

## Acceptance Criteria

- [x] Diff mode menu 不再渲染仓库切换 action。
- [x] 多仓库 staged/unstaged 标题是可访问 button，点击更新 `aria-expanded` 与文件行显隐。
- [x] 不同 workspace/repository/section 的折叠状态相互独立。
- [x] 现有 repository selector 与 Git operation signatures 无变化。
- [x] Focused Vitest、typecheck、OpenSpec strict validation 通过。

## Technical Notes

复用 `DiffSection` 的 `isCollapsed/onToggleCollapsed` contract；在
`GitMultiRepositoryChanges` 内维护 JSON-serialized composite key，避免路径 delimiter 冲突与跨 workspace 串状态。
