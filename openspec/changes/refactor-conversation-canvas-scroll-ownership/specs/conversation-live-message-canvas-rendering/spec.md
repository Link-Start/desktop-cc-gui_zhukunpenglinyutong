# Delta: conversation-live-message-canvas-rendering

## MODIFIED Requirements

### Requirement: Live Message Canvas MUST Stay Visually Stable During Streaming

The realtime conversation message canvas MUST keep the active assistant output readable while streaming text grows, even when virtualization and browser layout measurement are under pressure. Bottom placement ownership MUST follow the conversation-canvas-scroll-ownership authority model when that module is active.

#### Scenario: live assistant tail remains visible while text grows

- **WHEN** an assistant message is actively streaming text into the live tail row
- **THEN** the message canvas MUST keep that live row renderable and visible
- **AND** the system MUST NOT require history replay, turn completion, or a full timeline rebuild before newly arrived text becomes visible

#### Scenario: programmatic scroll echoes MUST NOT disarm bottom follow

- **WHEN** content height collapses and the browser clamps scrollTop, or a scroll convergence run completes
- **AND** a delayed scroll event matches an active write ticket applied ring entry or an unexpired legacy fingerprint under dual-run compatibility
- **AND** no explicit user-scroll intent is active
- **THEN** the system MUST NOT release bottom follow solely because of that event

#### Scenario: explicit user scroll intent MUST override echo heuristics

- **WHEN** wheel, scrolling-key, touch, pointer, or scrollbar input establishes explicit user-scroll intent
- **THEN** scrolling away from the bottom MUST release continuous follow
- **AND** if mode was `forced-bottom` and the upward intent meets the explicit threshold, forced mode MUST interrupt to free

#### Scenario: send boundary deterministically places the viewport at the bottom

- **WHEN** the same rendered conversation scope adds a new pending user message outside history loading or enters working state without a new optimistic user bubble
- **THEN** the message canvas MUST enter forced bottom placement and clear pre-boundary user-scroll intent
- **AND** this placement MUST NOT be blocked by the live auto-follow preference
- **AND** user scroll intent established after the boundary that meets explicit upward criteria MUST still be able to cancel later continuous pin

#### Scenario: settle boundary restores the final bottom without relying only on a fixed short timer

- **WHEN** the same rendered conversation scope exits working state
- **THEN** the message canvas MUST enter forced bottom placement
- **AND** late content-height growth, presentation settlement, or remeasure while forced remains active MUST be chased to true bottom
- **AND** forced mode MUST retire only when geometry stability and true bottom are met, or when the configured safety timeout forces a final pin
- **AND** a fixed multi-second settle deadline alone MUST NOT be the sole correctness condition for stopping bottom chase while forced is still the intended owner
