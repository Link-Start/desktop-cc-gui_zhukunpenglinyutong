# curated-skills-settings-sync Specification

## Purpose

TBD - created by archiving change. Update Purpose for `curated-skills-settings-sync`.

## Requirements

### Requirement: curated skill indicator MUST refresh on settings change event

`CuratedSkillIndicator` MUST 经事件驱动刷新启用状态，MUST NOT 使用秒级轮询。

#### Scenario: toggle reflects without polling

- **WHEN** 用户在 Settings 中切换 curated skill 启用状态
- **THEN** Rust MUST 在 `set_curated_skill_enabled` 成功后 emit `curated-skills-changed`
- **AND** indicator MUST 经事件订阅在秒级内重新拉取并刷新显示

#### Scenario: slow fallback poll remains as safety net

- **WHEN** 事件通道遗漏变更
- **THEN** indicator MUST 以不低于 30s 周期的 visibility-gated 轮询兜底收敛
- **AND** MUST NOT 存在秒级周期轮询
