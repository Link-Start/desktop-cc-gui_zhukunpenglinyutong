## Why

工作区右键菜单同时展开“新建会话”和“工作区操作”时纵向内容过长，常用的新建会话入口会被大量低频管理动作挤压。将工作区操作默认折叠，可降低菜单初始信息密度，同时保留原有动作的可达性。

## 目标与边界

- 仅调整 workspace menu 中“工作区操作”分组的展示状态。
- 每次打开菜单时该分组默认折叠，用户可在当前菜单实例中展开或再次折叠。
- 保持组内 action、pin checkbox、submenu 与 handler 语义不变。

## 非目标

- 不持久化折叠偏好。
- 不调整“新建会话”分组、thread/worktree context menu 或 action 排序。
- 不新增 backend command、storage key 或 dependency。

## What Changes

- 为 workspace menu group 增加显式的 collapsible/default-collapsed presentation contract。
- 将“工作区操作”配置为可折叠且默认折叠。
- 为分组标题增加 mouse/keyboard toggle、展开状态语义与 visual affordance。
- 增加 focused component tests，覆盖默认折叠、展开和再次折叠。

## 技术方案取舍

- **方案 A（采用）**：在 group model 上声明 `collapsible` / `defaultCollapsed`，由 overlay 使用 local UI state 渲染。语义明确，可测试，且不会把业务 group id 硬编码到通用 component。
- **方案 B（不采用）**：在 `SidebarWorkspaceMenuOverlay` 内判断 `group.id === "workspace-actions"`。改动更少，但把业务策略泄漏到 presentation component，后续复用容易 drift。

## Capabilities

### New Capabilities

- `sidebar-workspace-menu-group-collapse`: 定义 workspace menu 分组的默认折叠、临时展开与 accessibility 行为。

### Modified Capabilities

无。

## 验收标准

- 打开包含“新建会话”和“工作区操作”的 workspace menu 时，工作区 action rows 默认不可见。
- 点击或通过 keyboard 激活“工作区操作”标题后，action rows 可见且现有交互保持不变。
- 再次激活标题后 action rows 隐藏。
- 关闭并重新打开菜单后恢复默认折叠。
- focused Vitest、TypeScript typecheck 与 lint 通过。

## Impact

- Frontend：`useSidebarMenus` 的 group model、`SidebarWorkspaceMenuOverlay`、对应 CSS 与 focused tests。
- API/backend/storage：无影响。
- Dependencies：无新增。
