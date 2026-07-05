# Spec Delta: composer-selector-home-chat-simplification

## ADDED Requirements

### Requirement: Composer selectors MUST use stable shared selection primitives

Composer mode/model/reasoning selectors SHALL 在需要 searchable 或 modal selection 时使用 shared command/dialog primitives。

#### Scenario: 打开 selector

- **WHEN** 打开 selector
- **THEN** 当用户打开 mode/model/reasoning selector 时，selector 必须提供稳定 keyboard 和 pointer interaction，并更新下一轮使用的 composer state。

### Requirement: HomeChat MUST avoid unnecessary virtualization complexity

HomeChat SHALL 在内容规模可控时避免 dedicated virtualization layer。

#### Scenario: 首页内容渲染

- **WHEN** 首页内容渲染
- **THEN** 当 HomeChat 渲染正常首页内容时，应不依赖单独 HomeChat virtualization，并保持输入和交互响应。
