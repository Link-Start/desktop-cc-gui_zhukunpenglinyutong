## ADDED Requirements

### Requirement: Checklist tools MUST NOT classify as fileChange
The system SHALL treat tool names whose compact form is `todowrite` (case-insensitive, `_` / `-` stripped) as generic / MCP tool calls. Live `EngineEvent` projection, approval routing, and Shared canvas tool typing MUST NOT classify them as `fileChange` solely because the name contains `write`.

#### Scenario: Live todo_write keeps arguments
- **WHEN** the backend projects `ToolStarted` with `tool_name = "todo_write"` and input `{ "todos": [{ "content": "step", "status": "in_progress" }] }`
- **THEN** the app-server item `type` MUST NOT be `fileChange`
- **AND** the item title or tool field MUST preserve `todo_write`
- **AND** `arguments` / `input` MUST still contain the `todos` array

#### Scenario: Live TodoWrite is the same contract
- **WHEN** the backend projects `ToolStarted` with `tool_name = "TodoWrite"`
- **THEN** the item MUST follow the same non-fileChange contract as `todo_write`

#### Scenario: Real write tools stay fileChange
- **WHEN** the backend projects `ToolStarted` with `tool_name` in `{ "write", "write_file", "Write" }`
- **THEN** the item type MUST remain `fileChange`

### Requirement: Composer task pill reads the latest parseable checklist arguments
The Composer run-status task list SHALL update from the latest conversation tool whose name is `TodoWrite` / `todo_write` and whose detail JSON contains a `todos` array. A later live checklist call MUST replace the previous list in the same turn.

#### Scenario: Second todo_write replaces the strip
- **WHEN** the thread already shows three completed todos from an earlier `todo_write`
- **AND** a new live `todo_write` arrives with a different five-item list
- **THEN** the task pill MUST show the new list
- **AND** MUST NOT keep the previous 3/3 completed summary as current

#### Scenario: Canvas still hides checklist tools
- **WHEN** a `todo_write` / `TodoWrite` tool item is in the conversation
- **THEN** the canvas MUST continue to hide that tool card per existing hide rules

### Requirement: Checklist approval MUST NOT use the fileChange approval channel
The system SHALL NOT map a `todo_write` / `TodoWrite` approval request to `item/fileChange/requestApproval`.

#### Scenario: todo_write approval stays generic
- **WHEN** an `ApprovalRequest` arrives with `tool_name = "todo_write"`
- **THEN** the mapped method MUST NOT be `item/fileChange/requestApproval`
