## MODIFIED Requirements

### Requirement: User Bubble Parity MUST Collapse Optimistic And Authoritative Equivalents

optimistic, queued handoff, shared session, and authoritative history user observations MUST converge when they represent the same user intent.

Normalization MUST keep using `normalizeComparableUserText` and the existing wrapper strippers. The system MUST extend those strippers only when a failing case proves a remaining wrapper variant still drifts. After wrapper stripping and semantic comparison, equivalent observations MUST collapse to one visible user bubble. When they are not equivalent, the optimistic bubble MUST stay at its original index; the system MUST NOT append a second copy of the same intent.

#### Scenario: queued follow-up bubble converges with authoritative user item

- **WHEN** a queued follow-up is shown optimistically
- **AND** the authoritative user item arrives with equivalent normalized text
- **THEN** the system MUST keep one visible user bubble
- **AND** the authoritative item MAY replace local ids or metadata

#### Scenario: injected context does not create duplicate user rows

- **WHEN** authoritative history includes project memory, note-card, selected-agent, or shared-session wrappers
- **AND** the optimistic user bubble contained only the user-visible intent
- **THEN** normalization MUST treat them as equivalent user facts
- **AND** the visible transcript MUST NOT show duplicate user bubbles

#### Scenario: remaining wrapper variants still collapse to one user bubble

- **WHEN** authoritative history wraps the same user-visible intent in a project-memory, note-card, or agent-prompt variant that the current stripper does not yet peel cleanly
- **AND** a focused test demonstrates that `normalizeComparableUserText` currently fails to equate the optimistic text with that wrapped text
- **THEN** the stripper MUST be extended just enough to collapse those equivalents
- **AND** the system MUST NOT introduce fuzzy matching or partial-text collapse

#### Scenario: unmatched optimistic stays in place instead of duplicating

- **WHEN** an optimistic user bubble is not equivalent to any incoming authoritative user item after wrapper stripping
- **THEN** the optimistic bubble MUST remain at its original index
- **AND** the merge MUST NOT append a second user bubble that repeats the optimistic intent
- **AND** a later genuinely distinct user item MAY still appear as its own bubble

#### Scenario: distinct user messages remain distinct

- **WHEN** two user observations are not equivalent after wrapper stripping and semantic comparison
- **THEN** both messages MUST remain visible
- **AND** parity logic MUST NOT collapse them only because their text is partially similar
