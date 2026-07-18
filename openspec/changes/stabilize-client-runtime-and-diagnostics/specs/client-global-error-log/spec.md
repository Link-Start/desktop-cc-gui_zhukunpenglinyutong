## ADDED Requirements

### Requirement: Repeated STDERR MUST Be Redacted And Aggregated Before Persistence

Repeated renderer `stderr` diagnostics MUST be classified into privacy-safe signatures and aggregated in a bounded time window before they are appended to the global error log.

#### Scenario: known model refresh timeout repeats
- **WHEN** the Codex model refresh child-exit timeout repeats within the aggregation window
- **THEN** the global log MUST persist a bounded aggregate with a stable signature, count, first-seen time, and last-seen time
- **AND** it MUST NOT append one raw line for every repeat.

#### Scenario: unknown raw stderr string is received
- **WHEN** a top-level raw `stderr` string has no safe allowlisted classifier
- **THEN** the persisted payload MUST contain only bounded metadata such as redacted marker and original length
- **AND** it MUST NOT contain the raw prompt, assistant output, tool output, secret, token, or private command text.

#### Scenario: actionable error arrives while stderr aggregation is pending
- **WHEN** a core actionable error is recorded
- **THEN** it MUST be persisted without waiting for the low-value stderr aggregation window
- **AND** pending stderr MUST NOT hide or evict the actionable error.
