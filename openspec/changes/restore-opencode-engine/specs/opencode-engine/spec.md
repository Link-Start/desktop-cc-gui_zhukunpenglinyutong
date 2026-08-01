## ADDED Requirements

### Requirement: OpenCode One-Shot Engine Runtime

OpenCode CLI SHALL run as a one-shot headless engine (`opencode run --format json`) with block-level events surfaced to the conversation UI via the unified engine event stream, and synthetic streaming MAY smooth block-level text into incremental deltas.

#### Scenario: New OpenCode turn on a new thread

- **WHEN** the user sends the first message on an `opencode-pending-*` thread
- **THEN** backend SHALL spawn `opencode run --format json` with an explicit `--model <provider/model>`
- **AND** `SessionStarted` SHALL carry the `sessionID` parsed from the first JSONL event before any content event

#### Scenario: Continue an existing OpenCode session

- **WHEN** the user sends a message on an `opencode:<ses_*>` thread with continue semantics
- **THEN** backend SHALL pass `--session <ses_*>` and SHALL still pass an explicit `--model`

#### Scenario: Stream event mapping

- **WHEN** the CLI emits JSONL events on stdout
- **THEN** `text` events SHALL map to assistant text, `reasoning` to reasoning, `tool_use` to tool call/result entries, `step_finish` to usage update, and `error` to `TurnError`
- **AND** a single malformed JSONL line MUST NOT fail the turn
- **AND** turn completion MUST be derived from process exit with a `step_finish reason=stop` hint, not from `step_finish` alone

#### Scenario: Interrupt a running OpenCode turn

- **WHEN** the user stops a running OpenCode turn
- **THEN** backend SHALL kill the child process registered for that turn id
- **AND** the turn SHALL settle as stopped, not as an error

### Requirement: OpenCode Session History

OpenCode sessions SHALL be listable, loadable, and deletable from the GUI via the unified session catalog, scoped to the current workspace.

#### Scenario: List sessions for a workspace

- **WHEN** the thread list hydrates for an active workspace
- **THEN** `opencode_session_list` SHALL be registered as normal startup ownership and its sessions SHALL appear in the unified catalog

#### Scenario: Delete a session

- **WHEN** the user deletes an OpenCode session
- **THEN** backend SHALL remove the session from the OpenCode datastore without affecting other engines' sessions

### Requirement: OpenCode Engine Is Always Enabled

OpenCode SHALL be treated as a built-in always-enabled engine like Kimi and Grok; no settings toggle SHALL gate its execution or visibility.

#### Scenario: legacy disabled setting is loaded

- **WHEN** persisted configuration contains `opencodeEnabled: false`
- **THEN** settings normalization MUST NOT force the engine to disabled
- **AND** OpenCode SHALL appear in engine selection and composer provider list
