## MODIFIED Requirements

### Requirement: Provider Continuation MUST Expose Readable Identity And Source Navigation

A ready Provider Continuation MUST have a human-readable title and a discoverable relationship to its source Session. The relationship projection MUST be a compact, collapsible metadata row inside the existing message scroll flow and MUST NOT alter ordinary message grouping, streaming, completion, or scroll-anchor semantics.
Its interactive header MUST remain fully visible and operable while collapsed or expanded, MUST account for the shared Canvas topbar safe offset, and MUST NOT be clipped behind Canvas chrome during the toggle interaction. Source navigation MUST use a compact icon-only action without visible button text or resting button chrome while preserving an accessible name, tooltip, keyboard interaction, and disabled semantics.

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
- **THEN** the row header MUST remain fully visible below the shared Canvas topbar and above message content
- **AND** the user MUST be able to activate the same header again to restore the collapsed state

#### Scenario: source navigation is presented in expanded metadata

- **WHEN** the continuation metadata row is expanded and its source navigation is available
- **THEN** the navigation action MUST render as an icon without visible text, border, or resting background
- **AND** it MUST preserve an accessible name, tooltip, keyboard activation, and a visible hover or focus state
