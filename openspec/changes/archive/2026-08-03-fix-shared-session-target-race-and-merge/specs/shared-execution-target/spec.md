# shared-execution-target Specification (delta: MODIFIED)

## MODIFIED Requirements

### Requirement: Shared Target Change MUST Survive Identity Projection Loss

系统 MUST 在 Shared Session 中乐观更新 target 并防御 history reload 导致的 target 清空或降级。

#### Scenario: optimistic update renders before persist completes

- **WHEN** 用户在 Shared Session 中通过 Atomic 选择器切换 target
- **THEN** UI 的 `selectedNextTarget` MUST 在 persist 返回之前就已更新（乐观更新）
- **AND** UI MUST NOT 在 persist 期间被强制显示为「无 target / 全局 Native 回落」

#### Scenario: stale history reload does not clear selected target

- **WHEN** `sharedHistoryLoader` 返回不完整或为 null 的 `selectedTarget`
- **AND** store 中已有完整的 `selectedNextTarget`
- **THEN** loader MUST NOT 用 null 或不完整值覆盖 store

#### Scenario: generation advanced during load skips overwrite

- **WHEN** history load 开始后、结束前，store 的 persist generation 因 hydrate 递增
- **THEN** loader MUST 跳过本次 hydrate 覆盖
