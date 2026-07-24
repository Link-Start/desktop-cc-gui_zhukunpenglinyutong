## ADDED Requirements

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
