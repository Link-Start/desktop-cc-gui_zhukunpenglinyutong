# render-storm-background-polling-controls Specification

## Purpose
TBD - created by archiving change retro-render-storm-and-background-polling-controls. Update Purpose after archive.
## Requirements
### Requirement: Heavy UI subtrees MUST avoid unrelated app-shell root render storms

Heavy UI subtrees SHALL 避免仅因无关 app-shell root state 改变而重渲染。

#### Scenario: 无关 root state 更新

- **WHEN** 无关 root state 更新
- **THEN** 当 app-shell root 更新与某 heavy subtree 无关的状态时，该 subtree 应通过 stable props/callbacks 保持稳定，Composer input、visible messages、session activity、search UI 必须保持响应。

### Requirement: Background polling MUST be visibility-gated where safe

Background polling loops SHALL 在 owning surface 隐藏且无用户可见 freshness 要求时暂停或降频。

#### Scenario: surface 隐藏

- **WHEN** surface 隐藏
- **THEN** 当 polling-owned surface 隐藏或 inactive 时，其 polling loop 可以暂停或降频，但前台 runtime state 不得被延迟。

### Requirement: Virtualized row measurement MUST avoid destructive cache wipes

Virtualized timelines SHALL 在 targeted measurement 足够时 remeasure mounted rows，而不是清空整套 size cache。

#### Scenario: row 高度变化

- **WHEN** row 高度变化
- **THEN** 当 mounted row 高度变化时，virtualizer 必须重测受影响 row，避免不必要 full cache invalidation。

