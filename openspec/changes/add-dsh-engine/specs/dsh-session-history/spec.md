## ADDED Requirements

### Requirement: DSH history is host-RPC, not a local wire file

mossx SHALL list and load DSH conversations through `session.list` /
`session.history`. History read SHALL NOT resume or publish a DSH agent.

#### Scenario: Sidebar lists DSH sessions for the current workspace

- **WHEN** the user opens a mossx workspace bound to DSH workspace W
- **THEN** mossx SHALL show W's non-archived `sessionIds`
- **AND** each row id SHALL be `dsh:<sessionId>`

#### Scenario: Open an existing DSH thread after restart

- **WHEN** the user selects `dsh:<sessionId>`
- **THEN** mossx SHALL load `session.history` into the curtain via `dshHistoryLoader`
- **AND** SHALL NOT fall through to the Codex history loader

### Requirement: Delete archives instead of erasing logs

The first-wave Host RPC MUST NOT expose a physical session-file delete. mossx
delete SHALL call `workspace.archiveSession` instead of claiming the DSH logs
were removed from disk.

#### Scenario: User deletes a DSH conversation

- **WHEN** the user deletes a `dsh:<sessionId>` row
- **THEN** mossx SHALL archive that session on the DSH host
- **AND** the row SHALL disappear from the mossx sidebar
- **AND** mossx SHALL NOT claim the DSH log files were removed from disk
