## ADDED Requirements

### Requirement: Codex managed provider protocol incompatibility fails before runtime launch

Codex managed provider create-session MUST validate every configured model provider `wire_api` before materializing or launching app-server because Codex parses the complete provider map during config loading. When any configured wire protocol is unsupported by the current Codex integration, backend MUST return a stable non-secret diagnostic marker and frontend MUST present localized actionable guidance instead of a raw transport error.

#### Scenario: effective provider uses unsupported chat wire protocol

- **WHEN** a selected Codex managed provider declares top-level `model_provider = "<provider-id>"` and `[model_providers.<provider-id>].wire_api = "chat"`
- **THEN** create-session MUST fail before spawning Codex app-server
- **AND** backend error MUST contain stable marker `[codex_provider_wire_api_unsupported]`
- **AND** user-facing copy MUST explain that current Codex CLI does not support `wire_api = "chat"`
- **AND** user-facing copy MUST distinguish direct Responses API configuration from a required protocol conversion/router
- **AND** user-facing copy MUST NOT contain `Broken pipe` or raw OS error codes
- **AND** frontend MUST use the global custom sticky Error Toast instead of native `window.alert`

#### Scenario: effective provider uses responses wire protocol

- **WHEN** a selected Codex managed provider declares `wire_api = "responses"` for its effective provider
- **THEN** protocol preflight MUST allow the existing runtime launch flow to continue unchanged

#### Scenario: wire protocol is omitted

- **WHEN** a selected Codex managed provider omits `wire_api` or has no resolvable top-level `model_provider`
- **THEN** this protocol preflight MUST NOT invent a compatibility failure
- **AND** the existing Codex config parser and runtime error behavior MUST remain authoritative

#### Scenario: unselected provider table uses chat

- **WHEN** `configToml` contains an unselected provider table with `wire_api = "chat"` but the effective top-level `model_provider` selects a different provider
- **THEN** protocol preflight MUST reject the configuration before runtime launch
- **AND** diagnostic detail MUST identify the incompatible provider table without exposing credentials

#### Scenario: managed provider configuration is invalid TOML

- **WHEN** Codex managed provider `configToml` cannot be parsed, including values using non-ASCII smart quotes
- **THEN** backend MUST return stable marker `[codex_provider_config_invalid]`
- **AND** frontend MUST show localized guidance through the global custom sticky Error Toast
- **AND** user-facing copy MUST recommend checking TOML syntax and English half-width quotes
- **AND** user-facing copy MUST NOT include raw parser stack, source excerpt, credentials, or native `window.alert`
