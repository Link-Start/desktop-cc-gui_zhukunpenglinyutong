## MODIFIED Requirements

### Requirement: Global Runtime Notice Dock MUST Support Minimized Entry And Expandable Panel

系统 MUST 支持“最小化入口 + 展开面板”两种可见形态；desktop/tablet minimized entry MUST behave as a sidebar bottom icon action，phone fallback MAY remain app-level。

#### Scenario: minimized state uses stateful icon entry

- **WHEN** 客户端加载完成并展示全局 notice dock
- **THEN** 系统 MUST 在最小化状态显示一个 stateful icon entry
- **AND** 该 icon MUST 作为展开 notice 面板的唯一主入口

#### Scenario: minimized idle state communicates healthy status

- **WHEN** runtime notice dock 处于 minimized idle state
- **THEN** 系统 SHOULD use a success/healthy glyph such as `CircleCheck`
- **AND** MUST NOT use an ambiguous empty circle that can be mistaken for loading, radio selection, or missing state

#### Scenario: minimized notice and error states use distinct glyphs

- **WHEN** runtime notice dock 处于 minimized notice or error state
- **THEN** notice state SHOULD use a notice glyph such as `BellDot`
- **AND** error state SHOULD use an error glyph such as `CircleAlert`

#### Scenario: click entry expands the notice panel

- **WHEN** 用户点击 minimized runtime notice entry
- **THEN** 系统 MUST 展开提示框并展示当前 notice 内容
- **AND** 展开操作 MUST NOT 打断用户当前页面的主要工作流

#### Scenario: sidebar expanded panel uses compact popover

- **WHEN** desktop/tablet 用户从 sidebar bottom action group 展开 runtime notice panel
- **THEN** 系统 MUST 将 panel 渲染为 anchoring to that bottom action 的 compact popover
- **AND** panel 宽度 MUST 保持 viewport-safe，并 SHOULD use 560px as the default readable compact width unless a future spec changes the sidebar popover contract

#### Scenario: sidebar expanded panel escapes clipped ancestors

- **WHEN** desktop/tablet 用户从 sidebar bottom action group 展开 runtime notice panel
- **THEN** expanded panel MUST NOT remain trapped inside a sidebar overflow or stacking context that can clip the panel
- **AND** 系统 MAY render the panel through an app/body-level portal, provided the panel remains visually anchored to the runtime notice action

#### Scenario: expanded panel can be minimized again

- **WHEN** 用户在展开态点击 `最小化`
- **THEN** 系统 MUST 折叠回最小化入口
- **AND** 后续 notice push MUST 继续进入同一 feed

#### Scenario: new notices do not auto-expand the dock

- **WHEN** notice dock 处于最小化状态且有新的 notice 到达
- **THEN** 系统 MUST NOT 自动展开提示框
- **AND** 新状态 MUST 仅通过最小化入口的高亮语义反馈给用户

#### Scenario: first phase minimized state uses highlight instead of unread count

- **WHEN** 第一阶段最小化状态收到新的 error notice
- **THEN** 系统 MUST 使用 `has-error` 高亮语义提示变化
- **AND** MUST NOT 展示数字型未读角标
- **AND** 自 2026-06-05 `c585cc147`（`fix(runtime): 运行时提示仅显示错误消息`）起，dock 聚合状态有意简化为仅 `idle` / `has-error` 两态，MUST NOT 恢复独立的 `streaming` 运行中高亮态

### Requirement: Expanded Notice Panel MUST Provide Stable Header Layout And Empty State

第一阶段展开态 MUST 使用稳定的头部结构与空态结构，避免演变为通知中心式复杂面板。

#### Scenario: expanded panel uses fixed title and compact status badge

- **WHEN** 用户展开全局 notice panel
- **THEN** 面板头部 MUST 固定展示标题 `运行时提示`
- **AND** MUST 展示一个反映聚合状态的 compact 状态标签，取值仅 `空闲` 或 `异常`（2026-06-05 `c585cc147` 起 `运行中` streaming 态已随 error-only 简化移除）

#### Scenario: expanded panel header stays action-light in phase one

- **WHEN** 第一阶段渲染展开态 notice panel
- **THEN** 头部 MUST 仅包含标题、状态标签、`清空` 与 `最小化`
- **AND** MUST NOT 提供 tabs、filters、category switcher 或 message detail toggle

#### Scenario: empty panel shows stable guidance

- **WHEN** 当前 notice feed 为空
- **THEN** 展开态 MUST 显示稳定空态文案，例如 `暂无运行时提示`
- **AND** MUST 附带一句轻量辅助说明，提示初始化进度和关键错误会显示在这里
