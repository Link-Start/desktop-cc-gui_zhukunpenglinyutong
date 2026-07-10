## ADDED Requirements

### Requirement: Root render hot paths MUST avoid per-delta derived work

Realtime client performance optimizations MUST keep high-frequency assistant text deltas out of root-mounted derived work when a transient visible-text path can preserve the user-visible live surface.

#### Scenario: live assistant deltas do not force root conversation churn

- **WHEN** a streaming assistant body receives high-frequency text deltas
- **THEN** the client SHOULD route visible body growth through a bounded live-text subscription path
- **AND** the root conversation reducer MUST NOT be required to mutate for every text delta solely to update the latest visible row

#### Scenario: Git status refresh waits for turn settlement

- **WHEN** a conversation is processing and message activity occurs repeatedly
- **THEN** the root app shell MUST NOT trigger Git status refresh for every message activity event
- **AND** Git status refresh SHOULD run when a thread transitions from processing to settled
- **AND** existing periodic Git polling MAY remain as the fallback for external repository changes

#### Scenario: root-mounted local stores prefer broadcast updates over short polling

- **WHEN** debug, task-run, or orchestration store data changes inside the current webview
- **THEN** root-mounted consumers SHOULD update from write-broadcast events
- **AND** fallback polling MUST be slow enough to avoid continuous root render pressure
- **AND** unchanged snapshots MUST preserve object identity through equality guards
