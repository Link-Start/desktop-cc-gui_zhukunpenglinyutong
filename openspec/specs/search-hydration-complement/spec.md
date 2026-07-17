# search-hydration-complement Specification

## Purpose
TBD - created by archiving change workspace-tree-and-large-file-listing-budget. Update Purpose after archive.
## Requirements
### Requirement: Search Hydration MUST Treat Shared File Index As A Guarded Dependency

Search hydration MUST reuse the shared per-workspace file index when it is fresh and complete, but MUST retain shallow candidates, complete bounded full-snapshot hydration when required, preserve stale guards, and expose partial/error state when coverage is incomplete or unavailable.

#### Scenario: fresh complete shared index avoids duplicate listing

- **WHEN** a user searches and the target workspace has a fresh complete shared file index or completed full snapshot
- **THEN** search providers MUST read path candidates from that snapshot
- **AND** they MUST NOT issue a duplicate full file-listing IPC for the same source version.

#### Scenario: shallow active index does not block full hydration

- **WHEN** active-workspace search receives only shallow root file candidates
- **AND** a nested matching file is absent from those candidates
- **THEN** search MUST hydrate a bounded full workspace snapshot
- **AND** it MUST recompute file results with the hydrated candidates.

#### Scenario: global cache key does not imply completeness

- **WHEN** global search has an existing empty or shallow cache entry for a workspace
- **THEN** key presence MUST NOT classify that workspace as fully hydrated
- **AND** search MUST schedule full snapshot hydration for that workspace.

#### Scenario: full hydration is cached and bounded

- **WHEN** file search runs repeatedly in the same workspace or across multiple workspaces
- **THEN** completed and in-flight full snapshots MUST be reused
- **AND** the active workspace MUST be prioritized
- **AND** cross-workspace hydration concurrency MUST remain bounded.

#### Scenario: partial index state is visible

- **WHEN** the active workspace, another workspace, or a subtree remains partial
- **THEN** search UI MUST expose partial state in a way the user can distinguish from zero results
- **AND** runtime evidence MUST record whether the result set was full or partial.

#### Scenario: failed hydration remains retryable

- **WHEN** full workspace hydration fails
- **THEN** search MUST NOT cache an empty file array as a completed snapshot
- **AND** the UI MUST distinguish the error from a confirmed zero-result state
- **AND** a later qualifying search lifecycle MUST be able to retry hydration.

#### Scenario: stale search hydration is dropped

- **WHEN** the query, palette lifecycle, workspace, scope, or source version changes while hydration is in flight
- **THEN** the stale hydration result MUST be ignored or marked stale
- **AND** it MUST NOT replace newer results.

#### Scenario: independent search change ownership is preserved

- **WHEN** `search-index-and-bounded-hydration` still owns normalized indexing work
- **THEN** this change MUST only add the shared file-index bridge contract and fallback behavior
- **AND** it MUST NOT claim completion of search normalization tasks outside this change.

