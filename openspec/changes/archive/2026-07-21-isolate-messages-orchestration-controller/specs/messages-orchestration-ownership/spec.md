## ADDED Requirements

### Requirement: Isolated orchestration owners

Messages orchestration MUST compose distinct runtime、presentation、history、scroll and interaction owners.

#### Scenario: live stream state changes
- **WHEN** stream activity or live row content changes
- **THEN** only the owning runtime/live model MUST update, without recreating unrelated snapshot、navigation、interaction、presentation or slot models

### Requirement: Scoped deferred presentation state

Deferred presentation and history state MUST be scoped by workspace and thread identity.

#### Scenario: conversation scope changes
- **WHEN** either workspace or thread identity changes before a deferred snapshot is consumed
- **THEN** the previous scope snapshot MUST be rejected and MUST NOT affect the new conversation window

### Requirement: Dedicated scroll lifecycle ownership

Messages scroll convergence MUST have one lifecycle owner for follow state、programmatic echo suppression、settle budgets、pending jumps and cleanup.

#### Scenario: scroll scope unmounts or changes
- **WHEN** the messages scroll owner unmounts or moves to another workspace/thread scope
- **THEN** pending timers、animation frames and event listeners MUST be cleared without exposing raw state setters to consumers

### Requirement: Stable interaction composition

Message interaction handlers MUST be exposed through a stable typed model and MUST reuse the existing submission owner for approval and user input.

#### Scenario: presentation-only state changes
- **WHEN** grouping、history window or live presentation data changes without changing interaction dependencies
- **THEN** copy、toggle、context-menu、recovery、fork/rewind、note and file-open callback identities MUST remain stable

### Requirement: Bounded composition root

`MessagesCore.tsx` MUST remain a composition root below the roadmap line-count ratchet.

#### Scenario: orchestration extraction is complete
- **WHEN** the messages feature is built and verified
- **THEN** `MessagesCore.tsx` MUST contain fewer than 2200 lines and streaming body updates MUST remain row-local through `liveAssistantTextChannel`
