## MODIFIED Requirements

### Requirement: Shared history open MUST become interactive after V0 snapshot

When opening a Shared thread (`shared:*`), the system MUST treat a successful V0 session snapshot (`load_shared_session` / equivalent), including `items=[]`, as sufficient for first-paint readiness. The system MUST NOT keep the conversation history loading gate waiting solely for canonical projection to finish, and MUST NOT hard-wait projection when V0 is empty.

#### Scenario: Empty V0 snapshot unblocks history loading gate

- **GIVEN** a Shared thread whose V0 snapshot returns successfully with `items=[]`
- **WHEN** the history open path finishes loading that V0 snapshot
- **THEN** the system MUST return the Phase-A empty snapshot for first-paint
- **AND** MUST continue projection in the background up to the soft timeout
- **AND** MUST NOT throw solely because projection timed out or failed

#### Scenario: V0 load failure still fails closed

- **GIVEN** `loadSharedSession` itself rejects
- **WHEN** the history open path runs
- **THEN** the system MUST surface history load failure
- **AND** MUST NOT invent conversation items
