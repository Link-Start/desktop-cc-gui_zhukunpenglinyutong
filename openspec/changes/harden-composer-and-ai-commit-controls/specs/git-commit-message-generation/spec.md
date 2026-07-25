## MODIFIED Requirements

### Requirement: Commit message generation can reuse the last valid configuration

AI commit message surface MUST 提供复用最近一次有效 engine/model/language configuration 的可见 quick option；主生成按钮 MUST 保持显式 engine/language 选择入口，MUST NOT 因存在 persisted configuration 而静默直接执行。

#### Scenario: Reuse the last generation configuration

- **WHEN** 用户此前成功使用一组 generation configuration 且再次点击 commit message generation 主按钮
- **THEN** 系统 MUST 打开包含“使用上次配置”与当前可用 engine 的 menu
- **AND** 用户选择“使用上次配置”后 MUST 恢复该有效配置，无需逐项重新选择

#### Scenario: User switches engine and language after a previous run

- **WHEN** 已存在上次配置且用户点击 commit message generation 主按钮
- **THEN** 系统 MUST 允许用户选择其他可用 engine
- **AND** 选择 engine 后 MUST 允许选择 `zh` 或 `en`
- **AND** 系统 MUST 使用本次显式选择生成并保存新的 last configuration

#### Scenario: Last configuration is no longer available

- **WHEN** 记录的 engine、model 或 provider 已不在当前 catalog
- **THEN** “使用上次配置”quick option MUST 不可执行
- **AND** 系统 MUST 保持现有 engine/language 选择流程，不得启动不可用配置或覆盖当前 commit scope
