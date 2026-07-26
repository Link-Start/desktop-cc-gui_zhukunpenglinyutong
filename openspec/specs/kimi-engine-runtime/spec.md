# kimi-engine-runtime Specification

## Purpose
TBD - created by archiving change add-kimi-engine. Update Purpose after archive.
## Requirements
### Requirement: Kimi Canonical Session Identity Convergence

Kimi realtime runtime SHALL keep one user-visible conversation while a new turn
transitions from a frontend pending alias to the canonical session identity emitted
by Kimi CLI.

#### Scenario: New Kimi turn starts before canonical identity is known

- **WHEN** frontend sends the first turn on a `kimi-pending-*` thread
- **THEN** backend SHALL NOT return a fabricated canonical `sessionId`
- **AND** the pending id SHALL remain a runtime alias until Kimi emits a real `session_*` id

#### Scenario: History discovers canonical session before realtime promotion

- **WHEN** sidebar history adds `kimi:<session_*>` before the pending turn receives its identity update
- **THEN** pending promotion SHALL merge runtime items and lifecycle state into the existing canonical row
- **AND** sidebar SHALL display exactly one row for the conversation

#### Scenario: Kimi turn reaches a terminal state after promotion

- **WHEN** `turn/completed`, `turn/error`, or `turn/stalled` arrives for the canonical Kimi thread
- **THEN** processing and active-turn state SHALL be settled for the canonical thread and any matching pending alias
- **AND** no non-interactive orphan row SHALL remain permanently running

#### Scenario: Pending realtime delta flushes after canonical promotion

- **WHEN** a Kimi text delta enters the realtime queue with a `kimi-pending-*` id
- **AND** the session is promoted before that queued operation reaches the reducer
- **THEN** the operation SHALL resolve the latest canonical alias before applying
- **AND** `ensureThread`, processing state, and message content SHALL target the canonical row
- **AND** the retired pending id SHALL NOT be recreated or preserved as an anchored residual

#### Scenario: Canonical Kimi history row is selected or deleted

- **WHEN** the user selects or deletes the converged `kimi:<session_*>` row
- **THEN** history load/delete SHALL use the real Kimi session id from `session_index.jsonl`
- **AND** the operation SHALL NOT target a fabricated UUID or pending alias

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

