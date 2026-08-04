## ADDED Requirements

### Requirement: Canonical Projection MUST Decode Legacy Type-Less Envelopes Safely

`SharedProjector` MUST use the immutable event row `fact_type` as the discriminator when a legacy
canonical `payload_json` object lacks its tagged `type`. It MUST NOT mutate the stored row or its
checksum, and it MUST fail closed when an embedded payload type conflicts with `fact_type`.

#### Scenario: legacy delivery fact omits type

- **WHEN** a Shared event stream contains a canonical `context.deliveryPrepared` or
  `context.deliveryAccepted` row whose object payload lacks `type`
- **THEN** the projector MUST decode that row using the same row's `fact_type`
- **AND** it MUST continue projecting later `conversation.turnRequested` and
  `conversation.turnCommitted` facts
- **AND** it MUST NOT rewrite the legacy row

#### Scenario: embedded type conflicts with durable fact type

- **WHEN** a canonical event payload contains a `type` different from the row `fact_type`
- **THEN** projection MUST return a typed error
- **AND** it MUST NOT select either type silently

#### Scenario: legacy recovery produces a checkpoint

- **WHEN** a type-less legacy stream is rebuilt successfully
- **THEN** projection MUST persist the normal versioned checkpoint through the final sequence
- **AND** subsequent incremental loads MUST preserve item order and checksum identity
