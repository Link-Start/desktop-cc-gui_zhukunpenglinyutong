## ADDED Requirements

### Requirement: Executable Session Registry MUST Own Runtime Bindings

The backend MUST maintain one executable registry that maps logical session identity to current engine adapter、native binding、runtime generation and control lane.

#### Scenario: session is rebound

- **WHEN** recovery or provider switch creates a replacement runtime
- **THEN** the registry MUST atomically install the new generation
- **AND** the prior handle MUST become stale

### Requirement: Durable Session State MUST Contain Plain Data And Replay Cursor

Persistence MUST store identities、adapter/source facts、state transitions、last settled run and durable cursor, but MUST NOT serialize live handles、channels or callbacks.

#### Scenario: application restarts during an active run

- **WHEN** registry state is recovered
- **THEN** replay MUST converge to a deterministic recoverable/settled state
- **AND** settled work MUST NOT be executed again

### Requirement: Session Control MUST Be Deadlock Safe

Control commands MUST use a serial control lane separate from event handler execution; an event handler MUST NOT synchronously wait for a command whose result requires the same handler lane.

#### Scenario: settled handler queues next work

- **WHEN** `run.settled` makes a follow-up eligible
- **THEN** the handler MUST enqueue control work and return
- **AND** delivery MUST execute outside the event callback stack

### Requirement: Frontend Projection MUST Be Low Frequency

Frontend session catalog consumers MUST receive selector-based plain-data projections and MUST NOT subscribe AppShell root state to per-delta registry activity.

#### Scenario: message delta updates active run

- **WHEN** only streaming text changes
- **THEN** session registry shell projection MUST remain referentially stable
