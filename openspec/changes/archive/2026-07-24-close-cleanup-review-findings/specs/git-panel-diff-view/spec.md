## ADDED Requirements

### Requirement: Semantic review cache MUST track review inputs

The turn semantic review cache MUST be scoped by workspace, turn, output language, and the normalized diff entries used to produce the review.

#### Scenario: diff content changes after an early review
- **WHEN** a semantic review completes and the same turn later exposes different diff content
- **THEN** the stale cached review MUST NOT be reused
- **AND** a new review request MUST use the latest entries

#### Scenario: output language changes
- **WHEN** the user changes the semantic review output language for the same turn and diff
- **THEN** the prior-language cache entry MUST NOT be reused

### Requirement: Semantic engine fallback MUST remain serial

The client MUST NOT start a fallback semantic review engine while a previous engine request remains active and cannot be cancelled.

#### Scenario: primary engine request remains unsettled
- **WHEN** the primary hidden engine request has not settled and exposes no cancellation contract
- **THEN** the client MUST NOT start a fallback engine based only on a frontend timer
