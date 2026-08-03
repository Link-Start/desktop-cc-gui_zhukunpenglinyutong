## ADDED Requirements

### Requirement: Delivery Facts MUST Use The Canonical Writer Envelope

`context.deliveryPrepared` and `context.deliveryAccepted` MUST be serialized and appended through
the canonical writer boundary with their complete tagged envelope. Their event append and Binding
state update MUST remain atomic.

#### Scenario: delivery prepared is durably written

- **WHEN** context delivery enters the prepared phase
- **THEN** the stored payload MUST contain `type=context.deliveryPrepared`
- **AND** the row `fact_type` MUST contain the same value
- **AND** the pending Binding update MUST commit in the same transaction

#### Scenario: delivery acceptance is durably written

- **WHEN** runtime evidence accepts the prepared context package
- **THEN** the stored payload MUST contain `type=context.deliveryAccepted`
- **AND** the row `fact_type` MUST contain the same value
- **AND** the accepted cursor and pending phase MUST commit atomically with the fact

#### Scenario: duplicate delivery fact remains idempotent

- **WHEN** the same attempt and delivery fact are appended again
- **THEN** the canonical writer MUST resolve the existing sequence through its durable idempotency
  boundaries
- **AND** it MUST NOT append a second logical delivery fact
