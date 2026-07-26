## ADDED Requirements

### Requirement: Canonical Provider Binding MUST Be Persisted At Identity Promotion

当 runtime 首次暴露 canonical session identity 时，系统 MUST 将该 turn 已解析的 managed provider binding 持久化到 canonical session key，而不能只依赖 pending alias、parent id 或下一次 send。

#### Scenario: Kimi first turn promotes pending identity

- **WHEN** managed-bound Kimi turn 从 `kimi-pending-*` 收到真实 `SessionStarted.session_id`
- **THEN** backend MUST 幂等写入该 canonical Kimi session 的 provider binding
- **AND** 首轮结束后立即重启仍 MUST 从 catalog 恢复 provider metadata

#### Scenario: Claude fork receives child identity

- **WHEN** managed-bound Claude fork 的 child canonical session id 首次出现
- **THEN** backend MUST 将继承的 provider binding 写入 child canonical key
- **AND** MUST NOT 只更新 parent binding

#### Scenario: canonical binding persistence fails

- **WHEN** canonical binding metadata 写入失败
- **THEN** backend MUST 输出包含 engine、workspace 与 session identity 的可诊断错误
- **AND** MUST NOT 把失败报告成持久化成功

### Requirement: Provider Catalog Failure MUST Not Silently Change Provider

新会话入口读取 provider catalog 失败或 remembered managed provider 不可解析时，系统 MUST fail closed 或要求用户显式选择，不得静默改用 local/default provider。

#### Scenario: remembered managed provider is absent from loaded catalog

- **WHEN** localStorage 记住 managed provider A，但当前 catalog 未返回 A
- **THEN** 新会话菜单 MUST 保留 A 的不可用选择语义或阻止创建
- **AND** MUST NOT 自动选中 local/default 并继续创建

#### Scenario: provider catalog request fails

- **WHEN** Claude、Codex 或 Kimi provider catalog 加载失败
- **THEN** UI MUST 显示可诊断错误
- **AND** 用户显式选择 local/default 前 MUST NOT 把 remembered managed selection 解释为 local/default
