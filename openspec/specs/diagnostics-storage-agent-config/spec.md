# diagnostics-storage-agent-config Specification

## Purpose
TBD - created by archiving change retro-diagnostics-storage-and-agent-config. Update Purpose after archive.
## Requirements
### Requirement: Diagnostics storage MUST be isolated from ordinary user data

Client diagnostics data SHALL 通过 diagnostics-specific boundary 存储和导出，不得混入普通 workspace/session user data。

#### Scenario: 导出 diagnostics bundle

- **WHEN** 导出 diagnostics bundle
- **THEN** 当创建 diagnostics bundle 时，必须只从 diagnostics boundary 收集诊断事实，并避免包含 prompt、raw message、credential、workspace file content。

### Requirement: Host agent config MUST remain adapter glue

Codex/agent configuration files SHALL 被视为 host adapter glue，不得成为 runtime application source facts。

#### Scenario: app runtime 启动

- **WHEN** app runtime 启动
- **THEN** 当桌面 app runtime 启动时，产品行为不得依赖 `.codex/agents/*.toml` 作为 product data；这些文件只服务 AI workflow tooling。

