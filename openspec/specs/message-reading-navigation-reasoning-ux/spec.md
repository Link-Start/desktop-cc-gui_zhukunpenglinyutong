# message-reading-navigation-reasoning-ux Specification

## Purpose
TBD - created by archiving change retro-message-reading-navigation-and-reasoning-ux. Update Purpose after archive.
## Requirements
### Requirement: Message reading navigation MUST preserve transcript order

Conversation reading aids SHALL 帮助导航，但不得改变 canonical message order。

#### Scenario: 跳转用户消息

- **WHEN** 跳转用户消息
- **THEN** 当用户使用 navigation aid 跳转到某个 user turn 时，viewport 可以移动，但 underlying transcript order 必须保持不变。

### Requirement: Reasoning presentation MUST preserve content when merging adjacent same-segment thinking runs

Message renderer SHALL 在合并 adjacent same-segment reasoning/thinking runs 时保留全部 reasoning/thinking content。

#### Scenario: 同 segment thinking 合并

- **WHEN** 同 segment thinking 合并
- **THEN** 当相邻 thinking entries 属于同一 reasoning segment 时，UI 可以展示为连续 readable block，但不得丢弃 reasoning text。

### Requirement: Deferred Claude images MUST open inspectable previews

Deferred Claude image placeholders SHALL 在可 hydrate 或 preview 时支持打开 inspectable preview。

#### Scenario: 点击 deferred image

- **WHEN** 点击 deferred image
- **THEN** 当用户点击 conversation 中的 deferred Claude image 时，系统必须打开 lightbox 或等价预览。

### Requirement: Message surface MUST expose floating top and bottom navigation

The message reading surface MUST provide direct top/bottom navigation without overloading the user-message anchor rail.

#### Scenario: floating control jumps to bottom

- **WHEN** the user activates the message surface back-to-bottom control
- **THEN** the viewport MUST scroll to the latest output at the true bottom of the scroll container
- **AND** normal live bottom-follow MAY resume according to the live follow rules

#### Scenario: floating control jumps to top

- **WHEN** the user activates the message surface back-to-top control
- **THEN** the viewport MUST scroll to the top of the message surface
- **AND** the underlying transcript order MUST remain unchanged

#### Scenario: anchor rail remains dedicated to message anchors

- **WHEN** the conversation renders user-message anchors and top/bottom navigation
- **THEN** the anchor rail MUST continue to represent message anchors
- **AND** top/bottom navigation SHOULD be exposed through the floating scroll control rather than a special anchor-rail bottom entry

### Requirement: Read tool markdown rendering MUST ignore shell line-number prefixes

Read tool output that includes shell-added `cat -n` style line numbers MUST render the underlying file content rather than treating the line-number gutter as Markdown content.

#### Scenario: numbered read output renders clean markdown

- **WHEN** a Read tool block receives content with `cat -n` line prefixes
- **THEN** the renderer MUST strip those prefixes before Markdown rendering
- **AND** the visible content MUST preserve the file text without the artificial shell numbering gutter

### Requirement: Message anchor rail SHALL provide a direct bottom jump

The message reading navigation rail SHALL provide a direct way to return to the latest message area when multiple user-message anchors are visible.

#### Scenario: bottom jump appears below anchor dashes
- **GIVEN** the conversation has enough user messages to render the message anchor rail
- **WHEN** the rail is visible
- **THEN** the rail SHALL render a direct bottom jump affordance below the anchor dashes
- **AND** the affordance SHALL expose a localized accessible label

#### Scenario: bottom jump returns to latest content
- **GIVEN** the user has scrolled away from the latest message area
- **WHEN** the user activates the bottom jump affordance
- **THEN** the message viewport SHALL scroll to the bottom sentinel
- **AND** live auto-follow SHALL be allowed to resume for later output
- **AND** canonical transcript order SHALL remain unchanged

#### Scenario: expanded anchor panel does not block bottom jump
- **GIVEN** the conversation has many user-message anchors
- **WHEN** the anchor outline panel is expanded
- **THEN** the panel SHALL NOT intercept pointer access to the bottom jump affordance
- **AND** the bottom jump affordance SHALL remain visually aligned with the collapsed anchor rail

### Requirement: Message anchor rail MUST expose bounded single-anchor previews

消息阅读界面的 user-message anchor rail MUST 位于幕布左侧；每个可见 dash MUST 对应一个 bounded user-message anchor，并从顶部按有界间距紧凑排列。active anchor MUST 仅使用更深的视觉强调且保持默认长度；hover/focus 的 dash MUST 作为局部峰值横向拉长，邻近 dash MUST 按距离逐级收敛。系统 MUST NOT 因 hover rail 而展开包含全部 user turns 的目录面板。

#### Scenario: hovering one anchor shows only its preview

- **WHEN** 用户 hover 任意可见 message anchor dash
- **THEN** 系统 MUST 只展示该 anchor 的单个 preview card
- **AND** preview MUST 展示该 user message 的 title 与可用的 bounded plain-text description
- **AND** DOM 中 MUST NOT 同时渲染其他 anchor 的目录 row 或 preview card

#### Scenario: keyboard focus exposes the same preview and jump behavior

- **WHEN** keyboard focus 进入某个 message anchor dash
- **THEN** 系统 MUST 展示与 pointer hover 相同的单锚点 preview
- **AND** `Enter` 或 `Space` MUST 触发该 anchor 的既有 jump behavior

#### Scenario: preview remains inside the rail reading boundary

- **WHEN** 首部、尾部或中间位置的 anchor 展示 preview
- **THEN** preview placement MUST 根据 anchor 位置选择向下、居中或向上展开
- **AND** preview MUST 使用 bounded width 与 bounded text，避免覆盖为完整目录面板或越出可用 viewport 边界

#### Scenario: long conversation keeps anchor rendering bounded

- **WHEN** user-message anchor 数量超过 rail 的视觉预算
- **THEN** 系统 MUST 使用有界的代表性 dash 集合
- **AND** 当前 active anchor MUST 保留在可见 dash 集合中
- **AND** 每个 dash MUST 保持完整 user-turn 序列的先后顺序
- **AND** dash 间距 MUST 保持 bounded，不得因 anchor 数量较少而拉满 rail

#### Scenario: targeted anchor creates a bounded local protrusion

- **WHEN** pointer hover 或 keyboard focus 进入某个 anchor dash
- **THEN** 该 dash MUST 成为最长峰值
- **AND** 前后最多三根可见 dash MUST 按 index distance 对称、逐级缩短
- **AND** 局部范围之外的 dash MUST 保持普通长度
- **AND** active 但未 hover/focus 的 dash MUST 保持普通 dash 长度，仅使用更深颜色

#### Scenario: rail uses the approved compact visual scale

- **WHEN** rail 渲染 bounded anchor 集合
- **THEN** 普通 dash、hover/focus dash 与 row pitch MUST 使用紧凑尺寸，避免出现双倍放大的视觉比例
- **AND** preview card MUST 紧邻目标 dash，并使用 bounded compact width、padding、radius 与 shadow
- **AND** 视觉校准 MUST NOT 改变 anchor sampling、jump behavior 或 preview boundary placement

