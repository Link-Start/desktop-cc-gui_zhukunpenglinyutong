# composer-file-reference-index-availability delta — remove-kanban-and-task-center

## MODIFIED Requirements

### Requirement: Search And File-Reference Query MUST Reuse Indexed Candidates

Search and file-reference query computation MUST reuse cached normalized provider candidates when source versions have not changed. Kanban items are no longer a search provider source.

#### Scenario: query uses indexed candidates where available

- **WHEN** user types a search query repeatedly
- **THEN** query computation SHOULD use cached normalized provider candidates where available
- **AND** it MUST NOT rescan all raw files, messages, threads, history, skills, and commands for every keypress when their source versions have not changed
- **AND** it MUST NOT scan or rank Kanban / Task Center records
