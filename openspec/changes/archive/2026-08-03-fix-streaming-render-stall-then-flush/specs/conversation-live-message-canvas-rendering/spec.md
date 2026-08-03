## ADDED Requirements

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
