## ADDED Requirements

### Requirement: Claude Managed Provider Rows MUST Describe New-Conversation Availability

Claude provider management UI MUST represent managed providers as selectable launch profiles for new conversations, not as active runtime switches.

#### Scenario: managed provider row is available for new sessions

- **WHEN** 设置页渲染任意 managed Claude provider
- **THEN** status cell MUST 显示“新会话可选”的 localized badge
- **AND** row MUST NOT 显示“启用”按钮或触发 `vendor_switch_claude_provider`

#### Scenario: provider management does not mutate global Claude settings

- **WHEN** 用户在设置页 reorder、edit 或查看 managed Claude provider
- **THEN** 系统 MUST NOT 因 status interaction 写入 `~/.claude/settings.json`
- **AND** 既有 managed-bound conversations MUST 保持原 provider binding

#### Scenario: managed provider dialog describes isolated storage

- **WHEN** 用户新增或编辑 managed Claude provider
- **THEN** dialog description MUST 明确配置独立存储于 desktop-cc-gui
- **AND** MUST 明确不会写入 `~/.claude/settings.json`
- **AND** MUST NOT 使用“立即应用到 `~/.claude/settings.json`”之类的 global-switch 文案

#### Scenario: local official config remains explicit

- **WHEN** 设置页渲染 local `~/.claude/settings.json` official card
- **THEN** UI MUST 明确它是 local/default configuration
- **AND** MUST 保留编辑入口
- **AND** MUST NOT 把它描述成隔离的 managed provider
