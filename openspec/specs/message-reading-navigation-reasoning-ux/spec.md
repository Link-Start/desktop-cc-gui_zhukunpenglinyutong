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

