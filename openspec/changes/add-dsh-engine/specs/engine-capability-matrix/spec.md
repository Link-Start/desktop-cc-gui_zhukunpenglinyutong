## MODIFIED Requirements

### Requirement: Capability matrix includes DSH

The engine capability fixture SHALL include a `dsh` engine row covering every
capability key. Generated TypeScript and Rust matrices SHALL be regenerated
from that fixture.

#### Scenario: Query DSH streaming

- **WHEN** a caller asks the capability matrix for `dsh` / `streaming.text`
- **THEN** the state SHALL be `supported`

#### Scenario: Query DSH Shared-facing continuation

- **WHEN** a caller asks the capability matrix for `dsh` / `session.continuation`
- **THEN** the state SHALL be `unsupported` in this change
- **AND** Shared support collections SHALL remain without `dsh`
