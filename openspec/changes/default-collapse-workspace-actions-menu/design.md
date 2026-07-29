## Context

`useSidebarMenus` 生成由多个 `WorkspaceMenuGroup` 组成的 menu model，`SidebarWorkspaceMenuOverlay` 负责统一渲染 group title 与 action rows。当前 group 没有折叠语义，因此“新建会话”和“工作区操作”会同时完整展开。

该状态只在一次菜单打开期间有效，属于 transient UI state；没有跨菜单实例或跨启动持久化的需求。

## Goals / Non-Goals

**Goals:**

- 让 group model 显式表达是否可折叠及初始折叠状态。
- 仅将 `workspace-actions` group 配置为默认折叠。
- 通过 mouse 与 keyboard 操作展开/折叠，并暴露正确的 accessibility state。
- 不改变 action handler、pin toggle、submenu 与 menu close contract。

**Non-Goals:**

- 不把折叠状态写入 `clientStorage`。
- 不修改其他 context menu 或创建新的 shared accordion component。
- 不重排现有 workspace actions。

## Decisions

### Decision 1: 折叠策略属于 group model

在 `WorkspaceMenuGroup` 增加 optional `collapsible` 与 `defaultCollapsed` 字段。`buildWorkspaceMenuGroup` 设置两者为 `true`；`buildSessionMenuGroup` 沿用默认的不可折叠行为。

Alternative：overlay 直接识别 `workspace-actions` id。该方案代码更短，但 presentation component 会持有业务策略，降低 model 的自描述性，因此不采用。

### Decision 2: 使用 overlay-local `Set<string>` 管理状态

overlay mount 时从 `menu.groups` 的 `defaultCollapsed` 初始化 collapsed group id。toggle 只更新 local state；菜单关闭并重新 mount 后自然回到默认值。

Alternative：把状态放进 `useSidebarMenus` 或 storage。两者都会扩大 source-of-truth 与生命周期，且无法为当前需求提供额外价值，因此不采用。

### Decision 3: group title 在可折叠时渲染为 button

button 使用 `aria-expanded` 与 `aria-controls`，并显示 chevron。不可折叠 group 继续使用现有静态 title markup，避免无意义的 keyboard focus。

收起 group 时关闭其可能存在的 submenu，防止 root action rows 隐藏后仍残留 flyout。

## Risks / Trade-offs

- [Risk] group title 变成 button 后继承 browser 默认样式 → 使用 feature-scoped CSS reset，并复用现有 title typography/token。
- [Risk] hidden action rows 仍被 assistive technology 访问 → collapsed 时不渲染 action container，保证 DOM 与可见状态一致。
- [Risk] 未来 menu prop 在同一 mount 中替换 group → 当前 overlay 由 menu open state 控制生命周期；focused tests 固化每次新实例恢复默认状态。

## Migration Plan

1. 扩展 frontend group type 与 workspace group builder。
2. 更新 overlay render/state 与 CSS。
3. 增加 focused tests，运行 lint/typecheck/test。

Rollback：移除两个 optional group fields、toggle header 与 local collapsed state，即可恢复原有始终展开行为；无数据迁移。

## Open Questions

无。需求已明确默认折叠且不要求持久化。
