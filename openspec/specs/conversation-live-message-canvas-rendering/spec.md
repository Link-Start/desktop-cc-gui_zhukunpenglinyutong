# conversation-live-message-canvas-rendering Specification

## Purpose
TBD - created by archiving change harden-live-message-canvas-rendering. Update Purpose after archive.
## Requirements
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

### Requirement: Message Timeline Virtualization MUST Recover From Suspicious Empty Visible Sets

The message timeline MUST detect and recover from transient virtualization states that can blank or overlap the live message canvas.

#### Scenario: virtualizer collapse triggers bounded remeasure

- **WHEN** timeline virtualization is enabled
- **AND** the timeline has one or more projection rows
- **AND** the virtualizer reports no visible items while a scroll element is available
- **THEN** the system MUST request a bounded virtualizer remeasure or equivalent recovery nudge
- **AND** it MUST NOT disable virtualization globally as the primary recovery mechanism

#### Scenario: suspicious live row absence is handled without full rebuild

- **WHEN** an active live row is expected during streaming
- **AND** the virtualized visible set temporarily omits that row due to measurement or offset instability
- **THEN** the system MAY request bounded remeasurement or keep the live row in a stable render path
- **AND** it MUST NOT force parent timeline heavy derivations to recompute on every text delta

### Requirement: Live Canvas Render Instability MUST Leave Bounded Privacy-Safe Diagnostics

The system MUST record bounded diagnostics for suspicious live message canvas render states so triage can distinguish client render instability from upstream provider delay and backend forwarding stalls.

#### Scenario: diagnostics record virtualizer collapse without message text

- **WHEN** the live message canvas detects suspicious empty virtualizer output or live-row visibility risk
- **THEN** diagnostics MUST record bounded structural evidence such as row counts, virtual item counts, streaming state, and active-row expectation
- **AND** diagnostics MUST NOT include assistant message text, user prompt text, or full transcript content

#### Scenario: diagnostics remain bounded during long streaming turns

- **WHEN** a long streaming turn repeatedly enters the same suspicious render state
- **THEN** diagnostics MUST be rate-limited or otherwise bounded
- **AND** the diagnostic path MUST NOT become part of the per-delta render hot path

### Requirement: Live Runtime Cleanup Diagnostics MUST Be Low-Interruption

The realtime conversation message canvas MUST distinguish transient managed-runtime cleanup diagnostics from blocking runtime reconnect failures without changing backend lifecycle semantics.

#### Scenario: transient cleanup does not render as blocking failure
- **WHEN** an assistant diagnostic message contains `[RUNTIME_ENDED]`
- **AND** the diagnostic identifies expected managed cleanup such as `stale_reuse_cleanup` or `internal_replacement`
- **THEN** the live message canvas MUST render a lightweight runtime notice rather than the full blocking reconnect failure presentation
- **AND** the notice copy MUST describe background runtime switching / cleanup rather than connection failure
- **AND** the notice MUST NOT repeat raw `[RUNTIME_ENDED]` diagnostic text inside the card or as a separate message below it
- **AND** the notice styling MUST use existing theme tokens instead of OS-specific hardcoded surfaces

#### Scenario: blocking runtime failures keep recovery actions
- **WHEN** an assistant diagnostic message indicates broken pipe, workspace-not-connected, recovery quarantine, stale thread/session recovery, or runtime-ended without expected cleanup source
- **THEN** the live message canvas MUST keep the existing recovery actions available
- **AND** the UI MUST NOT suppress the failure as a transient cleanup status
- **AND** the UI MAY keep raw diagnostic detail visible for blocking recovery troubleshooting

#### Scenario: stale runtime diagnostics are not kept active after assistant output resumes
- **WHEN** a runtime reconnect diagnostic exists in the message history
- **AND** a newer assistant message is not a runtime reconnect diagnostic
- **THEN** the live message canvas MUST NOT render the reconnect card for the older diagnostic
- **AND** the older diagnostic's raw `[RUNTIME_ENDED]` / reconnect text MUST NOT remain visible as a normal assistant message
- **AND** a newer user message alone MUST NOT clear the card while the latest assistant message is still the diagnostic

#### Scenario: UI tone does not change lifecycle authority
- **WHEN** a runtime diagnostic is rendered with transient visual tone
- **THEN** frontend lifecycle settlement MUST still rely on existing runtime, backend, user action, or terminal turn authority
- **AND** the UI MUST NOT infer completion solely from assistant text visibility or historical output quality

#### Scenario: transient notice remains theme-compatible
- **WHEN** the app is running in light, dark, or system theme
- **THEN** the transient cleanup notice MUST inherit existing message surface, border, hover, and text tokens
- **AND** the implementation MUST NOT add platform-specific branches for macOS, Windows, or Linux
- **AND** Windows light / WebView2 surfaces MUST remain covered by the existing theme variable overrides

### Requirement: History Lightweight Rows MUST Compress Virtualized Layout Height

The message timeline virtualization layer MUST keep lightweight history summary rows visually compact and MUST NOT let stale heavy-row measurements create large blank canvas gaps.

#### Scenario: lightweight summary row does not inherit stale heavy height

- **WHEN** timeline virtualization is enabled for a completed history conversation
- **AND** a heavy projection row is rendered as a lightweight summary row
- **THEN** the virtualized row wrapper MUST use a compact lightweight placeholder height
- **AND** it MUST NOT use a stale heavy measured height as the row's minimum visual height

#### Scenario: expanded history uses document flow instead of virtual canvas

- **WHEN** a completed history conversation expands previously hidden history rows
- **THEN** the timeline MUST render those projection rows in normal document flow
- **AND** it MUST NOT use the absolute-positioned virtualized canvas for the expanded lightweight history view
- **AND** heavy rows MUST remain eligible for lightweight summaries when lightweight mode is active so the document-flow fallback does not hydrate every heavy row unnecessarily

#### Scenario: manual history reveal resets to the revealed history head

- **WHEN** the user clicks the control that reveals previously hidden history rows
- **THEN** the timeline MUST NOT restore the prior viewport by applying a `scrollHeight delta`
- **AND** the viewport MUST move to the revealed history head so the newly revealed top operation surfaces are visible

#### Scenario: expanded lightweight history keeps top operation card visible

- **WHEN** a completed history conversation expands previously hidden history rows
- **AND** the expanded lightweight history view renders in normal document flow
- **THEN** the lightweight operation card MUST render inside the same padded timeline flow as message rows
- **AND** the operation card MUST NOT be clipped by the top viewport boundary or application chrome
- **AND** the sticky history header MUST NOT require a separate extra top offset just because the lightweight operation card exists

#### Scenario: lightweight mode switch remeasures bounded layout

- **WHEN** the conversation enters lightweight mode or returns to hydrated detail mode
- **AND** timeline virtualization is enabled
- **THEN** the timeline MUST request a bounded virtualizer remeasure
- **AND** the system MUST NOT hydrate every heavy history row solely to recover spacing

#### Scenario: render details exits lightweight summary mode

- **WHEN** the user clicks the lightweight mode render-detail action
- **THEN** the timeline MUST render hydrated detail rows for the conversation
- **AND** the lightweight mode bar MUST no longer present the conversation as still in lightweight summary mode

### Requirement: Streaming Pacing MUST Not Restore Adaptive Timeline Rendering

The streaming render pacing fix MUST preserve static full-detail timeline rendering while adaptive timeline rendering is hard-disabled. Row-level staged Markdown rendering MUST remain distinct from conversation lightweight mode and MUST NOT mount a virtualized canvas or change anchor coordinates.

#### Scenario: long streaming conversation exceeds historical render thresholds

- **WHEN** a streaming conversation exceeds any historical row-count, render-weight, or oversized-conversation threshold
- **THEN** the message canvas MUST remain in static full-detail rendering
- **AND** it MUST NOT mount timeline virtualization, replace rows with lightweight conversation summaries, or display the lightweight-mode prompt

#### Scenario: message anchor navigation runs during streaming

- **WHEN** the user navigates to a message anchor while streaming pacing is active
- **THEN** anchor lookup MUST resolve against the fully mounted static DOM
- **AND** the pacing change MUST NOT introduce a static-to-virtual coordinate handoff
