## ADDED Requirements

### Requirement: Codex Provider Discovery MUST Use The Scoped Runtime Model List

Codex `Discover Models` MUST 通过目标 Provider binding 对应的 app-server session 执行 `model/list`，并与 configured/custom/fallback catalog 合并。

#### Scenario: Discover managed Provider models
- **WHEN** 用户为 Codex managed Provider B 执行 discovery
- **THEN** backend MUST acquire/reuse Provider B 的 app-server session
- **AND** MUST 向 Provider B session 发送 `model/list`
- **AND** MUST NOT 使用 legacy/default Codex session 的响应

#### Scenario: Discover local Codex models
- **WHEN** 用户为 Codex disk profile 执行 discovery
- **THEN** backend MUST 使用 canonical local Codex session identity
- **AND** MUST 返回 runtime model metadata

#### Scenario: Runtime unavailable
- **WHEN** Provider-scoped Codex app-server 无法启动或 `model/list` 失败
- **THEN** discovery MUST fail with binding-scoped diagnostics
- **AND** selector MUST 保留 last-good/configured/custom catalog

#### Scenario: Daemon does not support a managed runtime
- **WHEN** daemon mode 收到 managed Provider 的 discovery request
- **AND** daemon 尚未支持该 Provider runtime
- **THEN** command MUST 返回明确的 unsupported diagnostic
- **AND** MUST NOT 回退 disk/global Codex session
