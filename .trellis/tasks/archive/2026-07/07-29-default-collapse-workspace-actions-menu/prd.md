# 工作区菜单默认折叠

## Goal

关联 OpenSpec change：`default-collapse-workspace-actions-menu`。

让 workspace 右键菜单中的“工作区操作”分组支持折叠，并在每次打开菜单时默认折叠，减少菜单初始高度与信息密度。

## Requirements

- “工作区操作”分组默认折叠，“新建会话”分组维持展开。
- 分组标题支持 pointer 与 keyboard toggle，并暴露 `aria-expanded`。
- 展开后所有既有 action、pin checkbox 与 submenu 行为保持不变。
- 折叠状态仅在当前菜单实例内有效，不持久化。

## Acceptance Criteria

- [x] 默认不渲染 workspace action rows。
- [x] 点击或 keyboard 激活标题后显示 action rows。
- [x] 再次激活后重新隐藏 action rows。
- [x] 关闭并重开菜单后恢复默认折叠。
- [x] focused Vitest、typecheck、lint 与 OpenSpec strict validation 通过。

## Technical Notes

- 在 `WorkspaceMenuGroup` 声明 `collapsible/defaultCollapsed`，避免 overlay 硬编码 group id。
- 使用 `SidebarWorkspaceMenuOverlay` local `Set<string>` 维护 transient state。
- 不新增依赖、storage key 或 backend contract。
