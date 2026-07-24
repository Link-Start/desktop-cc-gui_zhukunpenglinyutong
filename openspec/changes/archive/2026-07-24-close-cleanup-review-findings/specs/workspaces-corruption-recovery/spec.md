## ADDED Requirements

### Requirement: Corrupted workspace backups MUST use unique targets

Each successful `workspaces.json` quarantine MUST create a new backup target and MUST NOT overwrite or collide with an existing corrupted backup, including repeated recovery attempts within the same second.

#### Scenario: two workspace quarantines occur within one timestamp second
- **WHEN** two corrupted `workspaces.json` files are quarantined before the timestamp second changes
- **THEN** both original byte sequences MUST remain in two distinct `.bak` sibling files
