## ADDED Requirements

### Requirement: Kimi Turn Interrupt MUST Be Owner-Scoped

Kimi turn-specific interrupt MUST 只改变真实拥有目标 turn child 的 runtime 状态；未命中的 provider runtime MUST 保持运行状态。

#### Scenario: interrupt targets one of two provider runtimes

- **WHEN** 同一 workspace 的 provider A 与 provider B runtime 均在运行，用户中断 provider A 的 turn
- **THEN** provider A 的目标 child MUST 被终止
- **AND** provider B MUST NOT 被标记 interrupted 或把正常完成误报为 `Session stopped.`

#### Scenario: targeted kill fails

- **WHEN** Kimi turn child 的 kill 返回错误
- **THEN** active process registry MUST 保留该 child owner
- **AND** error MUST 向 manager/command caller 传播

### Requirement: Kimi Provider Home Materialization MUST Be Secret-Safe And Concurrent

Kimi provider TOML materialization MUST 对同一路径串行化，并保证包含 API key 的 temp file 从创建瞬间起 owner-only。

#### Scenario: Unix temp file contains provider secret

- **WHEN** 系统创建包含 API key 的 provider TOML temp file
- **THEN** temp file MUST 在创建时即使用 0600 mode
- **AND** MUST NOT 先以默认可读权限写入后再 chmod

#### Scenario: concurrent materialization targets one provider

- **WHEN** 两个 turn 并发物化同一 provider home
- **THEN** writer MUST 通过同一路径 file lock 串行化 read-render-replace
- **AND** 最终 config.toml MUST 完整可解析且不存在 replace race

#### Scenario: rendered content is unchanged

- **WHEN** provider home 已包含完全相同的 TOML
- **THEN** materializer MUST 避免不必要的 replace
- **AND** Unix final file mode MUST 仍为 0600
