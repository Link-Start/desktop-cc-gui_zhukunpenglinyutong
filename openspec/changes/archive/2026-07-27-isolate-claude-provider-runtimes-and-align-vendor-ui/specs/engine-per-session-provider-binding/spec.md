## ADDED Requirements

### Requirement: Claude Runtime Ownership MUST Be Provider-Scoped

Claude runtime manager MUST use workspace owner and provider profile identity as the runtime ownership boundary while preserving shared Claude history storage.

#### Scenario: two managed providers run in parallel

- **WHEN** 同一 workspace 下 provider A 与 provider B 绑定的 Claude threads 并行发送
- **THEN** 系统 MUST 使用两个不同的 Claude runtime owners
- **AND** 每个 child process MUST 只接收自己 provider 的 environment
- **AND** session id、active turn、pending user input、approval state 与 child ownership MUST NOT 在两个 runtime 间共享

#### Scenario: local and managed provider run in parallel

- **WHEN** local/default Claude thread 与 managed provider thread 并行发送
- **THEN** local runtime MUST NOT 接收 managed provider env
- **AND** managed runtime MUST NOT 写入或切换 `~/.claude/settings.json`
- **AND** 两个 runtime MUST 能独立 interrupt 和完成

#### Scenario: secondary spawn inherits provider launch context

- **WHEN** managed Claude turn 触发 legacy flag retry、auto-compact、AskUserQuestion resume、approval resume 或其他 same-turn child restart
- **THEN** 每个 secondary child MUST 继承原 turn 的 provider launch context
- **AND** MUST NOT fallback 到 local/default environment

#### Scenario: workspace cleanup covers all Claude providers

- **WHEN** 用户 interrupt workspace、remove workspace、切换 Claude binary 或关闭 host
- **THEN** manager MUST 找到该 workspace 的全部 provider-scoped Claude runtimes
- **AND** cleanup failure MUST 保留未确认终止的 child owner并返回或记录可诊断错误

#### Scenario: turn interrupt targets one runtime

- **WHEN** 用户按 `turnId` 中断某个 Claude turn
- **THEN** manager MUST 只中断持有该 turn 的 provider runtime
- **AND** 其他 provider runtime 的并行 turn MUST 继续运行

#### Scenario: missing provider fails closed

- **WHEN** persisted thread binding 指向已删除或非法的 managed Claude provider
- **THEN** send MUST 返回包含 provider id 的 contextual error
- **AND** manager MUST NOT create or reuse local runtime as fallback

#### Scenario: legacy provider env scalar values are normalized

- **WHEN** imported 或 legacy managed Claude provider 的 `settingsConfig.env` 包含 JSON string、number 或 boolean scalar
- **THEN** shared provider resolver MUST 将 number 与 boolean 按 JSON scalar 语义规范化为 process env string
- **AND** provider-scoped model catalog 与 primary/secondary child launch MUST 使用同一份 normalized environment
- **AND** `null`、object 或 array value MUST 返回包含 provider id 与 env key 的 contextual error
- **AND** invalid composite value MUST NOT fallback 到 local/default runtime 或 global model catalog

#### Scenario: managed provider overrides user settings without global mutation

- **GIVEN** `~/.claude/settings.json` 包含另一供应商的 `ANTHROPIC_*` environment
- **WHEN** 绑定 managed provider 的 Claude turn 启动 primary child 或 same-turn resume child
- **THEN** child MUST 同时接收 normalized provider process env 与 command-line `--settings` override
- **AND** command-line settings MUST 包含当前 provider 的 auth、base URL 与 model environment
- **AND** Local settings 中的同名 environment MUST NOT 覆盖当前 provider
- **AND** secret MUST NOT 直接出现在 process arguments、日志或 diagnostic payload
- **AND** private settings artifact MUST 在 turn attempt 结束后清理
- **AND** local/default turn MUST NOT 创建或传入 managed settings override
