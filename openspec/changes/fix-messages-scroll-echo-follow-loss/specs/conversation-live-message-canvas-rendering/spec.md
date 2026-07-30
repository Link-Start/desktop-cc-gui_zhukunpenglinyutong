# Delta: conversation-live-message-canvas-rendering

## MODIFIED Requirements

### Requirement: Live Message Canvas MUST Stay Visually Stable During Streaming

The realtime conversation message canvas MUST keep the active assistant output readable while streaming text grows, even when virtualization and browser layout measurement are under pressure.

#### Scenario: live assistant tail remains visible while text grows

- **WHEN** an assistant message is actively streaming text into the live tail row
- **THEN** the message canvas MUST keep that live row renderable and visible
- **AND** the system MUST NOT require history replay, turn completion, or a full timeline rebuild before newly arrived text becomes visible

#### Scenario: active live row uses stable layout during streaming

- **WHEN** the active live row is receiving realtime deltas
- **THEN** the row MUST use a layout strategy that avoids stale measured height causing overlapping or disappearing content
- **AND** the strategy MUST remain local to the live canvas/tail path rather than forcing every historical row into a heavier rendering mode

#### Scenario: programmatic scroll echoes MUST NOT disarm bottom follow

- **WHEN** content height collapses (virtualization flip or live tail trim) and the browser clamps scrollTop, or a scroll convergence run completes
- **AND** a delayed scroll event arrives whose position matches the same unexpired programmatic write/clamp fingerprint
- **AND** no explicit user-scroll intent is active or recent
- **THEN** the system MUST treat the event as a programmatic echo and MUST NOT release bottom follow or cancel scroll convergence
- **AND** fingerprint freshness MUST be evaluated per entry; a newer write/observation MUST NOT renew an older unrelated fingerprint

#### Scenario: no-op convergence MUST NOT manufacture post-write grace

- **WHEN** a convergence frame observes that the viewport is already at its target and does not change `scrollTop`
- **THEN** it MUST NOT create or refresh a post-write fingerprint
- **AND** a later user scroll MUST NOT be exempted merely because a no-op frame or recheck recently ran

#### Scenario: explicit user scroll intent MUST override echo heuristics

- **WHEN** wheel, scrolling-key, touch, pointer, or scrollbar input establishes user-scroll intent
- **AND** the following scroll position matches a recorded fingerprint inside its grace window
- **THEN** the system MUST treat the event as user-controlled scrolling
- **AND** scrolling away from the bottom MUST release follow and cancel active convergence
- **AND** returning near the bottom MUST continue to re-arm follow through the existing near-bottom contract

#### Scenario: clamp fingerprints require geometry evidence

- **WHEN** ResizeObserver reports a geometry change
- **THEN** the system MUST record a clamp fingerprint only if max scroll range shrank, the previous position exceeded the new maximum, and the current position matches the new clamp target
- **AND** initial observation, content growth, ordinary remeasurement, or a user parked mid-history MUST NOT be classified as a browser clamp

#### Scenario: echo landing at the bottom re-arms follow

- **WHEN** a scroll event is classified as a programmatic echo while no convergence run is active
- **AND** the viewport position is near the bottom
- **AND** no explicit user-scroll intent takes precedence
- **THEN** the system MUST arm bottom follow, so a user scrolling back to the bottom restores following even when the event matches a pre-recorded clamp-target fingerprint

#### Scenario: echo fingerprints do not leak across threads

- **WHEN** the rendered conversation scope changes (workspace or thread switch)
- **THEN** the system MUST clear the programmatic echo fingerprint ring, geometry snapshot, and user-intent lease before any new convergence run starts

#### Scenario: adaptive timeline rendering remains disabled until coordinate handoff is safe

- **WHEN** any conversation reaches a row-count or render-weight threshold, enters/exits streaming, carries a legacy manual lightweight selection, or qualifies as oversized
- **THEN** the message canvas MUST remain in static full-detail rendering
- **AND** it MUST NOT mount the virtualized canvas, replace heavy rows with lightweight summaries, or display the lightweight-mode prompt
- **AND** message-anchor navigation MUST resolve against the fully mounted static DOM without a static-to-virtual coordinate transition
- **AND** adaptive rendering MUST NOT be re-enabled until initial-offset handoff and post-measure anchor preservation have focused regression coverage
