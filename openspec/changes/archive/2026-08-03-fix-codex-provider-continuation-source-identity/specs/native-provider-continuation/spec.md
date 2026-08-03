## ADDED Requirements

### Requirement: Provider Continuation Source Identity MUST Be Engine-Aware

Provider Continuation MUST 在读取来源 history 前验证 logical session identity 与 native session identity 的 Engine-specific 对应关系。Codex source MUST 接受 exact raw native thread id 或 `codex:` prefixed logical id；Claude 与 Kimi source MUST 继续使用各自的 prefixed logical id。Validator MUST 保留 caller 提供的合法 logical id，不得为通过校验而重写 lineage identity。

#### Scenario: raw Codex catalog identity is continued

- **WHEN** Codex source 的 `sessionId` 与 `nativeSessionId` 都是同一个 non-empty raw thread id
- **THEN** continuation preparation MUST 接受该 source identity
- **AND** materialization 与 lineage MUST 保留该 raw `sessionId`

#### Scenario: canonical Codex identity remains compatible

- **WHEN** Codex source 的 `sessionId` 为 `codex:<thread-id>` 且 `nativeSessionId` 为对应的 `<thread-id>`
- **THEN** continuation preparation MUST 接受该 source identity
- **AND** MUST NOT 去除 caller 提供的 canonical prefix

#### Scenario: Codex logical and native identities disagree

- **WHEN** Codex source 的 raw 或 prefixed `sessionId` 未映射到同一个 `nativeSessionId`
- **THEN** continuation MUST 在读取 source history 或创建 target side effect 前 fail closed
- **AND** MUST 返回 source identity mismatch diagnostic

#### Scenario: non-Codex source omits its Engine prefix

- **WHEN** Claude 或 Kimi source 的 `sessionId` 仅等于 raw `nativeSessionId`
- **THEN** continuation MUST 拒绝该 source identity
- **AND** canonical `<engine>:<nativeSessionId>` source MUST 保持可用
