## ADDED Requirements

### Requirement: Grok Composer Exposes Reasoning Effort Selector

Grok Native Session composer MUST expose a reasoning effort control using the fixed allowlist `low` / `medium` / `high`, plus an optional default (null) state that means “do not pass a CLI flag”.

#### Scenario: selector visible on Grok provider
- **WHEN** the active composer provider is `grok`
- **THEN** the UI MUST render a reasoning effort selector
- **AND** available options MUST be `low`, `medium`, and `high` (plus optional default)
- **AND** Gemini / Kimi / OpenCode MUST continue to hide the selector

#### Scenario: default means no explicit effort
- **WHEN** the user selects the default / empty effort for Grok
- **THEN** the effective composer effort MUST be `null`
- **AND** the Grok headless command MUST NOT include `--reasoning-effort` or `--effort`

### Requirement: Grok Effort Survives Session Normalization And Send

Selected Grok reasoning effort MUST survive thread composer selection normalization and pre-send engine-scoped normalization when it is within the allowlist.

#### Scenario: allowed effort persists on grok thread selection
- **WHEN** a `grok:` / `grok-pending-` thread selection stores `effort` in `{low,medium,high}`
- **THEN** `normalizeComposerSessionSelectionForThread` MUST keep that effort
- **AND** values outside the allowlist MUST be dropped to `null`

#### Scenario: allowed effort reaches send payload
- **WHEN** the user sends a message on a Grok engine with allowlisted effort
- **THEN** `normalizeEngineScopedEffort("grok", effort)` MUST return the trimmed effort
- **AND** `engine_send_message` / sync path MUST place it into `SendMessageParams.effort`

### Requirement: Grok Adapter Passes Reasoning Effort To CLI

Grok headless command construction MUST append `--reasoning-effort <level>` for allowlisted efforts and MUST ignore empty/invalid values.

#### Scenario: allowed effort becomes argv flag
- **WHEN** `SendMessageParams.effort` is `low`, `medium`, or `high`
- **THEN** `GrokSession::build_command` MUST append `--reasoning-effort` followed by that level
- **AND** model / session / prompt flags MUST continue to work as before

#### Scenario: invalid effort is dropped without flag injection
- **WHEN** effort is missing, blank, or not in the allowlist (e.g. `xhigh`, `ultra`)
- **THEN** the command MUST NOT contain `--reasoning-effort` or `--effort`
- **AND** the invalid token MUST NOT appear as a bare argv argument
