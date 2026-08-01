# Redesign File Tab Context Menu

## Goal

实现 `redesign-file-tab-context-menu` OpenSpec change：把文件 tab 的单项右键菜单升级为目标感知、带 icon、支持安全 Git 入口和完整关闭动作的共享 context menu。

## Requirements

- 右键动作绑定被点击 tab。
- 提供 Git 操作、关闭当前、关闭其他、全部关闭、在新窗口打开标签。
- Git 操作仅含显示文件历史与 Git Blame。
- main/detached tab state 各自原子执行 close-other。
- 复用 `RendererContextMenu`、detached window、file history 与 Git Blame。

## Acceptance Criteria

- [ ] OpenSpec tasks 全部完成。
- [ ] focused tests、lint、typecheck、large-file gate 通过。
- [ ] OpenSpec strict validation、verify、sync、archive 完成。

## Technical Notes

- OpenSpec: `openspec/changes/redesign-file-tab-context-menu/`
- Frontend-only change；不新增 Tauri command 或 dependency。
