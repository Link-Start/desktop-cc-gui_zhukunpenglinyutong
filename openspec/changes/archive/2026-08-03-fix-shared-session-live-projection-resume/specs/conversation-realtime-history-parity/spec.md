## ADDED Requirements

### Requirement: Running Shared live projection MUST survive conversation navigation

When a Shared Turn remains in progress, changing the active conversation MUST NOT detach the canonical Shared thread from its realtime assistant projection. The first assistant delta MUST establish a stable assistant item identity independently of active-thread presentation scheduling, subsequent body growth MUST remain on the bounded live-text path, and returning to the Shared thread MUST expose the latest published live text without requiring durable history reload.

#### Scenario: user leaves before the first assistant delta

- **WHEN** a Shared Turn is processing and the user activates another conversation before the first assistant delta arrives
- **THEN** the first delta MUST establish exactly one assistant shell on the canonical Shared thread
- **AND** the system MUST continue routing subsequent live text to that shell while the Shared thread is inactive

#### Scenario: user returns while the Shared Turn is still running

- **WHEN** an inactive Shared thread has accumulated published live assistant text and the user activates that Shared thread again
- **THEN** the conversation canvas MUST render the existing assistant shell with the latest published live text
- **AND** activation MUST NOT depend on a full canonical history reload

#### Scenario: Shared Turn completes while inactive

- **WHEN** a Shared Turn receives its authoritative terminal final while another conversation is active
- **THEN** the terminal final MUST settle into the same assistant item exactly once
- **AND** reopening the Shared thread MUST NOT show a prefix-only shell or duplicate assistant final

#### Scenario: navigation recovery preserves the render performance boundary

- **WHEN** multiple assistant body deltas arrive while the Shared thread is inactive or after it is reactivated
- **THEN** only first-shell, activation handoff, and terminal settlement MAY update structural reducer state
- **AND** subsequent body growth MUST NOT restore per-delta root reducer dispatch
- **AND** Shared activation MUST NOT synchronously flush pending operations owned by unrelated threads
