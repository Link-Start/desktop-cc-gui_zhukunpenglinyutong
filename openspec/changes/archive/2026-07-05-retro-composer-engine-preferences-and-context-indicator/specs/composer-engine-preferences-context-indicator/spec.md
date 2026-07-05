# Spec Delta: composer-engine-preferences-context-indicator

## ADDED Requirements

### Requirement: Composer preferences MUST be scoped by engine

Composer SHALL 按 engine scope 持久化 model、effort、permission、plan/collaboration preferences。

#### Scenario: Claude 切到 Codex

- **WHEN** Claude 切到 Codex
- **THEN** 当用户从 Claude 切换到 Codex 时，Composer 必须恢复 Codex-scoped preferences，不能覆盖 Claude preferences。

### Requirement: Context usage indicator MUST derive from usage facts

Context usage indicator SHALL 从 typed usage/model facts 渲染，并区分 pending、estimated、confirmed live usage。

#### Scenario: usage facts pending

- **WHEN** usage facts pending
- **THEN** 当 context usage 数据 pending、estimated 或 unavailable 时，indicator 必须区分状态，不能展示成 confirmed live usage。
