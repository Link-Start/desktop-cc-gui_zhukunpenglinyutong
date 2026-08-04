## ADDED Requirements

### Requirement: Claude Managed Enable MUST NOT Overwrite Local Disk Settings

启用 Claude managed provider（配置页「启用」或新建菜单选择）MUST 只更新 app 内 active 标记，MUST NOT merge 盖写用户 `~/.claude/settings.json`。

#### Scenario: settings enable managed provider leaves settings.json intact

- **WHEN** 用户在 Claude 供应商设置页点击 managed provider 的「启用」
- **THEN** 系统 MUST 将 `claude.current` 设为该 provider id（配置页显示「使用中」）
- **AND** 系统 MUST NOT 将该 provider 的 settingsConfig.env merge 进 `~/.claude/settings.json`
- **AND** 用户本地 `~/.claude/settings.json` 中既有 env/model 等字段 MUST 保持不变

#### Scenario: menu select managed provider same as non-covering enable

- **WHEN** 用户在新建会话菜单选择 Claude managed provider P
- **THEN** 系统 MUST 同步 L1 `claude.current = P`（配置页「使用中」）且 MUST NOT 盖写 `~/.claude/settings.json`
- **AND** 系统 MUST 记忆 P 供创建会话写入 thread `providerProfileId`

### Requirement: Global Enable And Session Binding MUST Remain Separate Layers

Claude L1「使用中」与 L2 会话 binding MUST 分层：L1 不盖盘；L2 负责 managed 会话 env。

#### Scenario: settings enable does not rewrite bound sessions

- **WHEN** 已存在携带 managed `providerProfileId` 的 Claude native 会话，用户在设置页启用另一 provider
- **THEN** 已绑定会话的后续发送 MUST 继续使用其 thread binding
- **AND** MUST NOT 因全局启用而改写该 thread 的 `providerProfileId`

#### Scenario: managed session launch uses profile not disk current

- **WHEN** 用户创建并发送绑定 managed provider P 的 Claude 会话
- **THEN** 进程 env MUST 来自 P 的 launch profile / turn-scoped `--settings`
- **AND** MUST NOT 依赖「先把 P 盖进 ~/.claude/settings.json」才能跑通
