## ADDED Requirements

### Requirement: Live mux projects DSH todos and context keys
mossx SHALL subscribe to host `session/projection` frames for `todos`, `contextPressure`, and `contextBreakdown` in addition to the already-handled `tokenUsage` and `sessionStats`. Unknown keys MAY still be skipped.

#### Scenario: todos frame is not dropped
- **WHEN** mux delivers `session/projection` with `key = "todos"` for a bound DSH session
- **THEN** mossx MUST emit a thread-scoped event carrying that snapshot
- **AND** MUST NOT treat the frame as an unknown no-op

#### Scenario: contextPressure and contextBreakdown frames are not dropped
- **WHEN** mux delivers `session/projection` with `key = "contextPressure"` or `key = "contextBreakdown"`
- **THEN** mossx MUST merge the value into the thread token-usage snapshot as specified by `dsh-context-usage`
- **AND** MUST NOT require a later `tokenUsage` frame before the UI may render occupancy
