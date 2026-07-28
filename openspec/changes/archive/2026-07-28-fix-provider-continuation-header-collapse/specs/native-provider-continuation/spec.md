## MODIFIED Requirements

### Requirement: Provider Continuation MUST Expose Readable Identity And Source Navigation

A ready Provider Continuation MUST have a human-readable title and a discoverable relationship to
its source Session. The relationship projection MUST be a compact, collapsible metadata row inside
the existing message scroll flow and MUST NOT alter ordinary message grouping, streaming,
completion, or scroll-anchor semantics. Its interactive header MUST remain fully visible and
operable while collapsed or expanded, and MUST NOT be clipped behind Canvas chrome during the
toggle interaction.

#### Scenario: continuation becomes ready

- **WHEN** a Provider Continuation target Session reaches ready
- **THEN** its sidebar/canvas identity MUST use a readable title instead of a protocol marker
- **AND** the canvas MUST expose source and target snapshots in a compact row that is collapsed by default
- **AND** the user MUST be able to open the source Session when it is still available

#### Scenario: continuation metadata is absent

- **WHEN** a Native Session is not a Provider Continuation or its metadata row is not rendered
- **THEN** the ordinary Messages DOM order, grouping, final separator, processing completion, and scroll-anchor behavior MUST remain unchanged

#### Scenario: source session is unavailable

- **WHEN** the recorded source Session no longer exists or is inaccessible
- **THEN** the continuation identity MUST remain readable from frozen snapshots
- **AND** source navigation MUST be disabled with an explicit explanation

#### Scenario: continuation metadata is toggled near the Canvas header

- **WHEN** the compact metadata row is collapsed or the user expands it while Messages is anchored near an edge
- **THEN** the row header MUST remain fully visible above the message content and below Canvas chrome
- **AND** the user MUST be able to activate the same header again to restore the collapsed state
