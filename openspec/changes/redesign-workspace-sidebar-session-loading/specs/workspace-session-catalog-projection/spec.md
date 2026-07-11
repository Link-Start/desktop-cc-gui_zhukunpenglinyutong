## MODIFIED Requirements

### Requirement: Catalog Hydration SHALL Not Block Foreground Thread Switching

Workspace catalog hydration SHALL be scheduled and committed so active thread switching and visible conversation interaction remain foreground work.

#### Scenario: active workspace catalog starts before background prewarm

- **WHEN** multiple workspaces require session hydration after restore
- **THEN** the active workspace SHALL be prioritized
- **AND** related or inactive workspace work SHALL be deferred or chunked without serially blocking active readiness

#### Scenario: stale hydration cannot overwrite a foreground refresh

- **WHEN** an older background hydration completes after a newer foreground refresh
- **THEN** request identity SHALL reject the stale result
- **AND** the stale completion SHALL NOT mark the workspace fully hydrated

