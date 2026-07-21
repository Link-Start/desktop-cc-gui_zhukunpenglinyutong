# messages-timeline-ownership Specification

## Purpose
TBD - created by archiving change isolate-messages-timeline-controller. Update Purpose after archive.
## Requirements
### Requirement: Isolated timeline owners

Messages timeline rendering MUST compose distinct row-dispatch、virtualizer、hydration and outline owners.

#### Scenario: timeline renders a projection row
- **WHEN** a projection row is rendered in static or virtualized mode
- **THEN** `TimelineRowRenderer` MUST preserve the existing wrapper、React key、error boundary、measurement ref and live probe contract

### Requirement: Stable keyed measurement refs

Timeline row measurement callback identity MUST remain stable for an unchanged row key across live-only rerenders.

#### Scenario: live props change for an existing row
- **WHEN** a row key remains mounted and only live presentation props change
- **THEN** React MUST NOT receive a synthetic `ref(null) -> ref(node)` cycle caused by a newly allocated callback ref

### Requirement: Dedicated virtualization and hydration ownership

Virtualizer lifecycle and heavy-row hydration lifecycle MUST have separate hook owners with explicit scope reset and cleanup.

#### Scenario: timeline scope changes
- **WHEN** workspace、thread、projection or renderer scope changes
- **THEN** each owner MUST reset only its own scoped state、budgets and pending animation frames without changing virtualization constants

### Requirement: Disabled outline remains inert

Outline state MUST preserve the current disabled-floater no-listener contract.

#### Scenario: outline floater is disabled
- **WHEN** `SHOW_OUTLINE_FLOATER` is false
- **THEN** active heading tracking MUST receive no outline and MUST NOT install window scroll or resize listeners
