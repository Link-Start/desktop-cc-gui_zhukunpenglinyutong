# Spec Delta: message-reading-navigation-reasoning-ux

## ADDED Requirements

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
