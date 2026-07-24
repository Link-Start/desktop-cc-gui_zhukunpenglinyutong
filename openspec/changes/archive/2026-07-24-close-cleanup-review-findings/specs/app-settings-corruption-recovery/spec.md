## ADDED Requirements

### Requirement: Corrupted settings backups MUST use unique targets

Each successful `settings.json` quarantine MUST create a new backup target and MUST NOT overwrite or collide with an existing corrupted backup, including repeated recovery attempts within the same second.

#### Scenario: two settings quarantines occur within one timestamp second
- **WHEN** two corrupted `settings.json` files are quarantined before the timestamp second changes
- **THEN** both original byte sequences MUST remain in two distinct `.bak` sibling files
