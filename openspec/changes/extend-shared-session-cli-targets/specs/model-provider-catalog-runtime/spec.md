## ADDED Requirements

### Requirement: Atomic Catalog MUST Load Kimi Grok And OpenCode Bindings

Atomic Shared/Home Provider Target catalog MUST load Kimi、Grok and OpenCode local/managed
Profiles and Models using the same `engine + providerProfileId` scope used by Runtime dispatch.

#### Scenario: profile loader returns all Shared CLIs

- **WHEN** Atomic catalog loads Provider Profiles
- **THEN** it MUST include Claude、Codex、Kimi、Grok and OpenCode groups
- **AND** canonical local sentinel rows MUST retain `source=disk`

#### Scenario: models remain binding scoped

- **WHEN** a Kimi、Grok or OpenCode managed Profile is expanded
- **THEN** `getEngineModels` MUST receive that exact Engine and Provider Profile
- **AND** Models from local config or another managed Profile MUST NOT leak into the row

#### Scenario: one new CLI catalog failure is isolated

- **WHEN** one newly supported CLI Profile or Model request fails
- **THEN** its binding MUST expose a scoped error
- **AND** other CLI/Profile groups MUST remain usable
