# composer-tool-menu-primary-controls Specification

## Purpose
TBD - created by archiving change retro-composer-tool-menu-and-primary-controls. Update Purpose after archive.
## Requirements
### Requirement: Composer secondary tools MUST be grouped behind a compact tool menu

Composer SHALL 在直接 toolbar 空间有限时，将 secondary tools 和 shortcut actions 分组到 compact `+` menu。

#### Scenario: 普通工作区聊天

- **WHEN** 普通工作区聊天
- **THEN** 当 Composer toolbar 渲染时，secondary tools 必须可从 `+` menu 到达，submit/stop 仍保持立即可见。

### Requirement: Permission mode and reasoning depth MUST be visible before submit

Composer SHALL 在提交下一轮之前暴露当前 permission mode 和 reasoning depth。

#### Scenario: 编辑 draft

- **WHEN** 编辑 draft
- **THEN** 当用户正在编辑 draft 时，permission mode 和 reasoning depth 必须在 primary row 可见或直接可达，并影响下一次提交。

