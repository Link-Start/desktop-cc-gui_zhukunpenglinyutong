# engine-runtime-identity Specification

## Purpose
TBD - created by archiving change establish-logical-session-runtime-identity. Update Purpose after archive.
## Requirements
### Requirement: Runtime Identity MUST Separate Logical Native And Pending Session Identities

The system MUST model user-visible logical session identity、engine-native session identity and provisional pending alias as distinct typed identities.

#### Scenario: native identity is confirmed after pending creation

- **WHEN** an engine emits its native session identity after a pending conversation is visible
- **THEN** the pending alias MUST map to the existing logical session
- **AND** the system MUST NOT create a second user-visible conversation

#### Scenario: legacy persisted thread is loaded

- **WHEN** a record contains only a legacy prefixed thread id
- **THEN** a single compatibility boundary MAY derive missing engine/native facts
- **AND** downstream business code MUST consume explicit identity fields

### Requirement: Runtime Events MUST Carry Stable Run Turn And Item Identity

Every runtime event that belongs to execution output MUST be correlatable by logical session and stable run identity; turn/item events MUST additionally carry their applicable turn/item identity.

#### Scenario: delta and terminal evidence arrive through different paths

- **WHEN** a text delta and terminal event originate from different engine forwarders
- **THEN** both MUST resolve to the same logical session and run
- **AND** terminal settlement MUST target the same turn/item lineage

### Requirement: Retired Aliases MUST Converge Late Events

An alias retired by canonical promotion MUST retain a bounded forwarding tombstone for events already in flight.

#### Scenario: late delta targets retired pending alias

- **WHEN** a queued delta arrives after pending-to-canonical promotion
- **THEN** it MUST be forwarded to the canonical logical session
- **AND** it MUST NOT recreate pending UI or processing state

### Requirement: Engine Prefix Inference MUST Be Confined To Compatibility Boundaries

Production business modules MUST NOT add new literal engine-prefix branches outside the identity compatibility boundary.

#### Scenario: literal branch is introduced

- **WHEN** CI scans a new `startsWith("<engine>:")` business branch
- **THEN** the governance gate MUST fail unless the location is an approved boundary adapter
