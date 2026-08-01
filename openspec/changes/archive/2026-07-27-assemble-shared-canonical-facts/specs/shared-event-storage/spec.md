# shared-event-storage Specification

## MODIFIED Requirements

### Requirement: Event Storage MUST Use SQLite WAL With Single-Writer Transaction Semantics

The store MUST use SQLite in WAL mode with `foreign_keys=ON`, `synchronous=FULL`, and a bounded `busy_timeout`; all writes MUST go through one `SharedEventWriter` actor, and event insert plus per-session sequence allocation MUST commit in one SQLite transaction. Canonical-fidelity facts MUST enter through `SharedEventWriter::append_canonical_fact`, which validates payload fields before delegating to the actor.

#### Scenario: sequence allocation and event insert are atomic

- **WHEN** an event is appended for a session
- **THEN** the new sequence value and the event row MUST be committed in the same transaction
- **AND** if any statement in that transaction fails, both the event row and the `next_sequence` bump MUST roll back
- **AND** per-session sequence MUST be monotonic, with gaps permitted after crashes but never duplicates

#### Scenario: single writer authority

- **WHEN** any component wants to persist a canonical event, binding state, cursor, or usage record
- **THEN** it MUST go through `SharedEventWriter`
- **AND** no API MUST allow callers to supply their own sequence values
- **AND** frontend, renderers, and engine adapters MUST NOT write the database directly

#### Scenario: cloned handles cannot terminate active callers

- **WHEN** more than one `SharedEventWriter` handle exists
- **THEN** shutdown from a clone MUST be rejected with a typed error
- **AND** the actor MUST remain usable until only the final handle requests shutdown

#### Scenario: direct arbitrary envelope append is rejected

- **WHEN** a caller tries to append a raw JSON envelope as a canonical-fidelity fact
- **THEN** the public canonical API rejects it before sequence allocation
- **AND** presentation-only shadow facts remain available only through their explicit entry point
