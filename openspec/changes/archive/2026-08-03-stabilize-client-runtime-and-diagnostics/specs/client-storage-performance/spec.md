## ADDED Requirements

### Requirement: Diagnostics Retention MUST Reserve Actionable Evidence By Category

Persisted renderer diagnostics MUST keep category-specific bounded budgets so repeated performance samples cannot evict all error, Worker failure, renderer stability, or stream-stall evidence.

#### Scenario: frame-drop samples reach their category cap
- **WHEN** repeated frame-drop samples reach the configured performance category cap
- **THEN** the store MUST evict or aggregate older frame-drop samples within that category
- **AND** it MUST preserve the bounded error/stability and stream-latency categories.

#### Scenario: identical low-value diagnostics repeat
- **WHEN** an identical low-value diagnostic repeats enough to pressure its category budget
- **THEN** the store MUST aggregate, sample, or cap that signature
- **AND** it MUST NOT grow the full diagnostics store without bound.

#### Scenario: Fast Markdown Worker fails

- **WHEN** Worker creation, request processing, bounded timeout, or runtime execution fails
- **THEN** the renderer diagnostics store MUST receive a rate-limited, content-safe failure reason
- **AND** the persisted entry MUST NOT include Markdown source, prompt text, generated HTML, or raw exception content.

#### Scenario: diagnostic store is loaded after restart
- **WHEN** persisted diagnostic categories are loaded after restart
- **THEN** every category MUST be sanitized and clipped to its current bound
- **AND** sensitive fields MUST be redacted even when a malformed legacy value has the wrong primitive type
- **AND** malformed legacy entries MUST not block startup.

#### Scenario: renderer lifecycle is ending

- **WHEN** the renderer receives `pagehide` or becomes hidden
- **THEN** pending diagnostics and the lifecycle event itself MUST bypass the normal disk-write debounce
- **AND** the persisted payload MUST still pass the same sanitizer and category bounds.
