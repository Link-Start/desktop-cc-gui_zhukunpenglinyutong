## MODIFIED Requirements

### Requirement: Native Model Selector MUST Be Scoped To Its Current CLI Providers

Native Session 的 Composer model selector MUST 只展示来源 Session 当前 CLI 下的
Provider Profiles 与 Provider-scoped Model catalogs；它 MUST NOT 把其他 CLI 作为 model
group 展示。该约束 MUST 覆盖 Claude、Codex、Kimi、Grok 与 OpenCode Native Session。

#### Scenario: Claude native session lists only Claude providers

- **WHEN** 用户在 Claude Native Session 打开 model selector
- **THEN** selector MUST 展示 Claude CLI 的 local 与 managed Provider Profiles
- **AND** MUST NOT 展示 Codex CLI 或 Kimi CLI group

#### Scenario: Codex native session lists only Codex providers

- **WHEN** 用户在 Codex Native Session 打开 model selector
- **THEN** selector MUST 展示 Codex CLI 的 disk 与 managed Provider Profiles
- **AND** MUST NOT 展示 Claude Code 或 Kimi CLI group

#### Scenario: Kimi native session preserves capability boundary

- **WHEN** 用户在 Kimi Native Session 打开 model selector
- **THEN** selector MUST 展示 Kimi CLI 的 Provider Profiles
- **AND** 未验证为 continuation target 的其他 Kimi Provider MUST 保持不可选并展示原因
- **AND** 当前绑定 Provider 内的 Model selection MUST 继续可用

#### Scenario: Grok native session lists only Grok providers

- **WHEN** 用户在 Grok Native Session 打开 model selector
- **THEN** selector MUST 只展示 Grok CLI 的 Provider Profiles 与 scoped Models
- **AND** MUST NOT 展示 Claude、Codex、Kimi 或 OpenCode CLI group

#### Scenario: OpenCode native session lists only OpenCode providers

- **WHEN** 用户在 OpenCode Native Session 打开 model selector
- **THEN** selector MUST 只展示 OpenCode 的 Provider Profiles 与 scoped Models
- **AND** MUST NOT 展示 Claude、Codex、Grok 或 Kimi CLI group
