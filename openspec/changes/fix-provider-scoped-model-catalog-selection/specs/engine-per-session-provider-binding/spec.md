## ADDED Requirements

### Requirement: Local Session Provider Tags MUST Identify Disk Configuration

When session-list provider labels are enabled, local Codex and Claude Code sessions MUST render the stable technical tag `local` so users can distinguish disk-backed configuration from managed providers.

#### Scenario: Codex disk session is listed

- **WHEN** a Codex thread is bound to `__disk__`
- **THEN** its provider tag MUST display `local`
- **AND** it MUST NOT expose the internal profile name `codex-tui/default-config`

#### Scenario: Claude Code local session is listed

- **WHEN** a Claude Code thread is bound to `__local_settings_json__`
- **THEN** its provider tag MUST display `local`

### Requirement: Provider Configuration Badges MUST Use Consistent Semantics

The new-conversation provider selector MUST describe local/disk profiles and managed profiles with the same semantic labels across Claude Code, Codex, and Kimi CLI.

#### Scenario: local or disk provider row

- **WHEN** the selector renders Claude local `settings.json`, Codex disk/default config, or Kimi local `config.toml`
- **THEN** the badge MUST use the localized equivalent of `跟随全局配置`
- **AND** it MUST NOT use an engine-specific synonym such as `磁盘配置`

#### Scenario: managed provider row

- **WHEN** the selector renders a managed Claude Code, Codex, or Kimi provider
- **THEN** the badge MUST use the localized equivalent of `独立配置`
- **AND** it MUST NOT use an engine-specific synonym such as `自定义配置`

## MODIFIED Requirements

### Requirement: Provider Catalog Failure MUST Not Silently Change Provider

新会话入口读取 provider catalog 失败、model catalog 失败或 remembered managed provider 不可解析时，系统 MUST fail closed 或要求用户显式选择，不得静默改用 local/default provider。

#### Scenario: remembered managed provider is absent from loaded catalog

- **WHEN** localStorage 记住 managed provider A，但当前 catalog 未返回 A
- **THEN** 新会话菜单 MUST 保留 A 的不可用选择语义或阻止创建
- **AND** MUST NOT 自动选中 local/default 并继续创建

#### Scenario: provider catalog request fails

- **WHEN** Claude、Codex 或 Kimi provider catalog 加载失败
- **THEN** UI MUST 显示可诊断错误
- **AND** 用户显式选择 local/default 前 MUST NOT 把 remembered managed selection 解释为 local/default

#### Scenario: bound provider model catalog fails

- **WHEN** 新会话已绑定 managed provider A，但 provider A 的模型配置缺失、损坏或不可读取
- **THEN** 模型菜单 MUST 保留 last-good catalog 或显示可诊断错误
- **AND** MUST NOT 展示 local/default provider 的 configured models 作为成功结果

### Requirement: Codex Session Model Fallback MUST Follow Bound Provider

Codex new-session creation and model-omitted sends MUST resolve their fallback model from the bound provider profile. Provider display names, including `Kimi`, MUST remain opaque labels and MUST NOT influence engine routing.

#### Scenario: managed Codex provider creates a session

- **WHEN** 用户为 Codex engine 选择 managed `providerProfileId=A`
- **THEN** backend MUST start provider A's Codex runtime
- **AND** `thread/start.model` MUST use provider A's configured default model
- **AND** it MUST NOT use the workspace disk/global Codex model

#### Scenario: managed Codex provider has no configured default model

- **WHEN** provider A 的 `configToml` 没有 non-empty top-level `model`
- **THEN** `thread/start` MUST omit `model`
- **AND** runtime MUST resolve its own provider default
- **AND** backend MUST NOT substitute the disk/global model

#### Scenario: provider profile is named Kimi

- **WHEN** Codex managed provider profile 的 display name 为 `Kimi`
- **THEN** routing MUST remain `engine=codex` with provider A's id
- **AND** it MUST NOT invoke or classify the session as Kimi CLI

### Requirement: Codex Create-Session Transport Failure MUST Recover Without Raw OS Error

Codex create-session MUST treat a closed app-server pipe as a recoverable runtime disconnect and retry once inside the same provider identity.

#### Scenario: first thread start hits broken pipe

- **WHEN** selected Codex provider runtime returns `Broken pipe` during the first `thread/start`
- **THEN** backend MUST clean/reacquire the same provider runtime
- **AND** retry `thread/start` once with the same `providerProfileId`
- **AND** it MUST NOT fall back to `__disk__`

#### Scenario: pipe disconnect persists

- **WHEN** the same-provider retry also returns a pipe disconnect
- **THEN** backend MUST return the stable `[SESSION_CREATE_RUNTIME_RECOVERING]` error contract
- **AND** frontend MUST show a recoverable notice instead of native `alert`
- **AND** user-facing copy MUST NOT contain `Broken pipe` or raw OS error codes
