# engine-per-session-provider-binding Specification (delta: MODIFIED)

## MODIFIED Requirements

### Requirement: Per-Session Provider Binding MUST Be Recorded And Resolvable

系统 MUST 将 managed provider 绑定建模为会话级 launch configuration（而非全局切换），并在发送消息时按固定优先级解析生效供应商。

#### Scenario: resolution priority

- **WHEN** 后端为某个 thread 的一次发送解析供应商
- **THEN** 解析优先级 MUST 为：send 参数携带的 managed `providerProfileId` > catalog metadata 中该 thread 的持久化 managed binding > 无绑定/default
- **AND** 无绑定时 MUST 保持变更前的行为（Claude 走全局 `~/.claude/settings.json`，Kimi 走全局 `~/.kimi-code/config.toml` / 引擎默认 home）

#### Scenario: Claude runtime model is resolved against bound profile catalog

- **WHEN** Claude managed-bound thread 发送消息且携带 model / model catalog entry 选择
- **THEN** 系统 MUST 使用 **该 thread 绑定 profile** 的 model catalog（及 profile env model 槽）解析最终 runtime model
- **AND** MUST NOT 使用其它 profile 或全局脏 mapping 残留作为 `--model`
- **AND** 解析失败时 MUST fail closed 或 repair 到绑定 profile 默认 runtime，不得静默发送跨供应商模型名

## ADDED Requirements

### Requirement: UI Selection MUST Repair When Bound Profile Catalog Changes

当 Native Claude 会话的绑定 profile 或该 profile 的 model catalog 变化后，composer 选中态 MUST 与新 catalog 对齐。

#### Scenario: foreign runtime after provider switch is repaired

- **WHEN** 用户将会话上下文切换到另一 managed Claude profile（含续接成功后的目标会话，或切到绑定不同 profile 的老会话）
- **AND** 当前 composer selection 的 runtime 不属于新 profile 的合法 model 集合
- **THEN** 系统 MUST 将 selection repair 为新 profile 默认 runtime 对应的 catalog entry
- **AND** 后续发送 MUST 使用 repair 后的 runtime
