## ADDED Requirements

### Requirement: Diagnostics Persistence Must Not Create Idle CPU Storms

Conversation diagnostics MUST avoid high-frequency durable writes on normal streaming and idle paths.

#### Scenario: Watchdog scheduling is not durably mirrored by default

- **WHEN** Codex progress evidence reschedules the no-progress watchdog repeatedly
- **THEN** `codex-no-progress-watchdog-scheduled` diagnostics MUST NOT be force-persisted into `diagnostics.threadSessionLog`
- **AND** higher-value liveness diagnostics such as `fired`, `skipped`, `suspected`, and `recovered` MUST remain available for failure analysis.

#### Scenario: Thread list responses do not persist large raw payloads

- **WHEN** thread list refresh receives a full server response
- **THEN** the raw `thread/list response` payload MUST NOT be mirrored into the durable thread session log
- **AND** fallback, timeout, and error diagnostics MAY still be persisted when they are bounded and actionable.

#### Scenario: Idle composer render budgets do not churn diagnostics storage

- **WHEN** the composer is idle, not processing, enabled, and has empty text
- **THEN** `perf.composer.render-budget` MUST NOT append a durable renderer diagnostics entry
- **AND** active processing or non-empty composer samples MAY still be recorded when perf diagnostics collection is enabled.
