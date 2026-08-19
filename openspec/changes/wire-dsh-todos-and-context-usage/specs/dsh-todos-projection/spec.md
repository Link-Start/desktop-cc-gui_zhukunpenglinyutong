## ADDED Requirements

### Requirement: DSH task list is the host todos projection
For engine `dsh`, the Composer task pill SHALL treat the host `session/projection` key `todos` as authoritative. The value is the latest whole-list snapshot from `todo/write`. A later `turn/start` that publishes an empty list SHALL clear the pill.

#### Scenario: Live todo/write updates the pill
- **WHEN** mux delivers `session/projection` with `key = "todos"` and a five-item list
- **THEN** the DSH task pill MUST show that list and its per-status counts
- **AND** MUST NOT keep a previous three-item completed list as current

#### Scenario: turn/start clears the standing plan
- **WHEN** the host publishes `todos` as an empty array after `turn/start`
- **THEN** the DSH task pill MUST hide or show empty
- **AND** MUST NOT fall back to the last `todo_write` tool row

#### Scenario: Missing projection may fall back to tool scan
- **WHEN** a DSH thread has never received a `todos` projection (`null`)
- **THEN** the pill MAY scan `todo_write` / `TodoWrite` tool arguments
- **AND** an explicit empty projection MUST still win over that fallback

### Requirement: History hydrates todos from projections.values
Opening an existing DSH session SHALL seed the task snapshot from the history page `projections.values.todos` when present. History MUST NOT require replaying `todo/write` events onto the canvas to restore the pill.

#### Scenario: Reopen a DSH thread
- **WHEN** the user selects `dsh:<sessionId>` whose history page has `projections.values.todos`
- **THEN** the task pill MUST restore that list before the next mux frame
- **AND** the canvas MUST NOT gain extra visible TodoWrite cards solely to feed the pill
