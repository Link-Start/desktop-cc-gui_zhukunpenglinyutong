## ADDED Requirements

### Requirement: Engine Controller Facade MUST Delegate Foundation Ownership

The AppShell engine controller facade MUST delegate engine registry、capability、catalog、lifecycle and storage migration facts to their canonical domain owners.

#### Scenario: AppShell requests engine snapshot

- **WHEN** AppShell consumes engine selection、availability、models or notices
- **THEN** the facade MUST compose typed low-frequency projections
- **AND** it MUST NOT maintain duplicate registry、capability or catalog facts

### Requirement: Engine Controller Migration MUST Preserve Public Behavior

Ownership migration MUST preserve engine selection、model selection、refresh、availability and runtime notice behavior until callers adopt narrower APIs.

#### Scenario: one domain owner is extracted

- **WHEN** selection or catalog ownership moves out of the controller
- **THEN** characterization tests MUST prove facade-equivalent output/actions
- **AND** dual writes MUST be removed before that migration task closes

### Requirement: Engine Controller Facade MUST Stay Outside High-Frequency Render Paths

The facade MUST NOT subscribe to message delta arrays、per-event bus snapshots or second-level polling.

#### Scenario: assistant text streams

- **WHEN** only live assistant text changes
- **THEN** AppShell engine controller snapshot MUST remain referentially stable
- **AND** shell/layout recomputation MUST not be caused by the facade
