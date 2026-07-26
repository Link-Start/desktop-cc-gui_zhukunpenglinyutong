## ADDED Requirements

### Requirement: Kimi Identity Promotion MUST Survive Event Reordering

Kimi pending-to-canonical promotion MUST migrate items、processing、active turn、selection、title and live assistant text ownership as one logical-session transition.

#### Scenario: history arrives before resume hint

- **WHEN** canonical history row appears before pending runtime receives native session identity
- **THEN** both rows MUST converge to one logical session
- **AND** no message or processing state may be duplicated

#### Scenario: late delta arrives after promotion

- **WHEN** a queued delta targets the retired pending alias
- **THEN** it MUST update the canonical row
- **AND** pending state MUST not be recreated

### Requirement: Kimi Config Diagnostics MUST Distinguish Missing Corrupt And IO Failure

Kimi model/provider config loading MUST return structured `missing`、`loaded`、`malformed` or `io-error` status.

#### Scenario: config is missing

- **WHEN** Kimi config file does not exist
- **THEN** builtin fallback MAY load without an error

#### Scenario: config cannot be parsed

- **WHEN** the file exists but is malformed
- **THEN** the system MUST expose actionable diagnostics
- **AND** it MUST NOT represent the state as ordinary missing config

### Requirement: Kimi Provider Cleanup MUST Report Partial Success

Deleting a managed provider and cleaning namespaced Kimi config entries MUST report each durable outcome.

#### Scenario: managed provider deletes but config cleanup fails

- **WHEN** ccgui provider deletion succeeds and Kimi config write/rename fails
- **THEN** the result MUST be partial success with warning
- **AND** UI MUST identify possible residual config

### Requirement: Kimi Engine Governance MUST Cover Runtime History Lifecycle And Provider Paths

Kimi MUST participate in built-in engine branch scanning、capability parity、runtime/history/lifecycle/provider contract tests.

#### Scenario: new Kimi literal branch is added

- **WHEN** code adds a Kimi-specific business branch outside an approved adapter
- **THEN** the engine branch scanner MUST fail
