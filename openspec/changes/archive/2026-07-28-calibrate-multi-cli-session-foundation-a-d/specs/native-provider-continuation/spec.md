## ADDED Requirements

### Requirement: Provider Continuation MUST Probe Import Capability Before Target Creation

Provider Continuation MUST derive structured history import support from a runtime method probe before creating the target native session. It MUST NOT infer support from an Engine constant, frontend literal or version string.

#### Scenario: Codex runtime lacks history import method
- **WHEN** the Codex App Server returns method-not-found for the import probe
- **THEN** Context Compiler selects transcript/checkpoint before target Thread creation
- **AND** continuation uses the portable prompt transport instead of calling the missing import method

### Requirement: Prepared-Only Integrity Failure MUST Be Rebuilt Safely

Provider Continuation MUST delete and rebuild a stale `prepared` operation only when no target
side effect or result Session exists. Later phases MUST retain durable identity and fail closed.

#### Scenario: legacy prepared checksum is no longer valid
- **WHEN** a `prepared` operation has an invalid artifact and no result Session
- **THEN** the old prepared record is removed and the same validated request is materialized again
- **AND** no second target Session can be created

### Requirement: Degraded Continuation Confirmation MUST Work In Desktop Shells

Provider Continuation MUST present an actionable confirm/cancel decision through a Desktop-shell-compatible dialog on macOS, Windows and Linux.

#### Scenario: WebView native confirm is unavailable
- **WHEN** a continuation requires degraded confirmation in a Tauri WebView
- **THEN** the user can still confirm or cancel through the supported Desktop dialog and no target is created on cancel
