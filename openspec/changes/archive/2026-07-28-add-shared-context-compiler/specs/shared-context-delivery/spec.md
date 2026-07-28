## ADDED Requirements

### Requirement: Context Delivery MUST Use Two-Phase Cursor

Each target Binding MUST persist separate `acceptedThroughSequence` and `committedThroughSequence` values plus a durable pending delivery. Compile, acceptance, and canonical commit MUST advance only their own boundary.

#### Scenario: compile failure advances nothing

- **WHEN** context compilation fails before delivery preparation commits
- **THEN** no pending delivery MUST be written
- **AND** accepted and committed cursors MUST remain unchanged

#### Scenario: context ack advances accepted only

- **WHEN** the runtime-specific Adapter explicitly accepts a package
- **THEN** `context.deliveryAccepted` MUST be appended and accepted cursor advanced
- **AND** committed cursor MUST remain unchanged until terminal canonical commit

#### Scenario: accepted run failure does not replay package

- **WHEN** a package was accepted and the subsequent run fails
- **THEN** accepted cursor MUST NOT roll back
- **AND** retry MUST NOT inject the same package again

#### Scenario: terminal commit clears pending

- **WHEN** `conversation.turnCommitted` is durably committed for the attempt
- **THEN** committed cursor MUST advance through the accepted package
- **AND** matching pending delivery MUST be cleared

### Requirement: Pending Delivery MUST Be Crash Recoverable

Pending delivery MUST record package/checksum, sequence, operation, phase, client identity, native identity when known, timestamps, and probe attempts.

#### Scenario: ack ambiguity fails closed

- **WHEN** runtime delivery may have succeeded but its ACK is lost
- **THEN** pending delivery MUST remain in an ambiguous recoverable phase
- **AND** the system MUST probe before retrying the external side effect

#### Scenario: restart restores pending state

- **WHEN** the app restarts with a prepared or sent-awaiting-ack delivery
- **THEN** the Shared composer MUST restore a non-idle recovery state
- **AND** another target MUST NOT bypass the linear pending operation

### Requirement: Runtime Context ACK MUST Match Adapter Evidence

Adapters MUST use their declared capability evidence and MUST NOT treat process spawn, stdin write, or first token as universal context acceptance.

#### Scenario: Codex import requires JSON-RPC success

- **WHEN** Codex uses `thread/inject_items`
- **THEN** context accepted MUST be recorded only after a successful JSON-RPC response
- **AND** timeout/disconnect MUST remain ambiguous rather than fallback-send a duplicate

#### Scenario: Claude transcript requires checksum echo

- **WHEN** Claude receives transcript/checkpoint context with a package checksum marker
- **THEN** acceptance MUST require a matching replay echo
- **AND** a mismatched or missing echo MUST enter recovery-required

#### Scenario: weak Kimi ack is explicit

- **WHEN** Kimi capability does not expose a strong context ACK
- **THEN** the Adapter MUST report weak or unsupported fidelity
- **AND** the system MUST NOT claim exactly-once acceptance
