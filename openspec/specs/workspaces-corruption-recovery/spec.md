# workspaces-corruption-recovery Specification

## Purpose
TBD - created by archiving change preserve-corrupted-workspaces-on-load-and-notify. Update Purpose after archive.
## Requirements
### Requirement: Backend Workspaces Load MUST Preserve Corrupted Files Before Fallback

When `workspaces.json` cannot be read or parsed, the GUI `AppState::load` and daemon `DaemonState::load` MUST rename the corrupted file to a timestamped backup (for example `workspaces.json.corrupted-<UTC timestamp>.bak`) before falling back to an empty workspace map, and MUST emit a log line describing the failure and the backup outcome. A subsequent workspaces save MUST NOT overwrite the user's original corrupted content.

#### Scenario: corrupted workspaces file is quarantined before default fallback
- **WHEN** `workspaces.json` exists but contains invalid JSON
- **THEN** backend load MUST rename it to a `.corrupted-<timestamp>.bak` sibling file with the original bytes preserved
- **AND** load MUST fall back to an empty workspace map with a `[storage]` log line
- **AND** a later `write_workspaces` MUST create a fresh `workspaces.json` rather than destroying the corrupted original

#### Scenario: missing workspaces file keeps first-run behavior
- **WHEN** `workspaces.json` does not exist
- **THEN** backend load MUST return an empty workspace map without creating any backup file and without logging a corruption warning

### Requirement: Backend MUST Record A Workspaces Corruption Recovery Notice

When the GUI `AppState::load` quarantines a corrupted `workspaces.json`, it MUST record a recovery notice in memory containing the backup file name (or a null file name when the backup rename itself failed). A dedicated `take_workspaces_recovery_notice` command MUST return the pending notice and clear it in the same call (take semantics), so the notice can be consumed exactly once. Successful loads MUST NOT record any notice. The daemon `DaemonState` has no UI surface and MUST keep its quarantine-only behavior without recording a notice.

#### Scenario: quarantine records a notice with the backup file name
- **WHEN** `workspaces.json` is corrupted and quarantine renames it to `workspaces.json.corrupted-<timestamp>.bak`
- **THEN** the recorded notice MUST contain that backup file name
- **AND** the first `take_workspaces_recovery_notice` call MUST return the notice
- **AND** a subsequent `take_workspaces_recovery_notice` call MUST return null

#### Scenario: clean startup leaves no notice
- **WHEN** workspaces load succeeds without corruption
- **THEN** `take_workspaces_recovery_notice` MUST return null

### Requirement: Frontend MUST Surface The Workspaces Recovery Notice On Startup

After the `useWorkspaces` hook mounts, it MUST call `takeWorkspacesRecoveryNotice` exactly once. When a notice is returned, it MUST push exactly one localized toast whose message names the backup file (or uses the backup-failed copy when the file name is null). Toast title and message MUST resolve through i18n keys present in at least the `zh` and `en` locale bundles; other languages fall back to English. A failure of the notice fetch itself MUST NOT break or delay the workspaces list load.

#### Scenario: startup with a pending notice surfaces one toast
- **WHEN** the hook mounts and the backend holds a workspaces recovery notice with a backup file name
- **THEN** the hook MUST push exactly one toast via the shared toasts service
- **AND** the toast message MUST contain the backup file name

#### Scenario: startup without a notice stays silent
- **WHEN** the hook mounts and no recovery notice is pending
- **THEN** the hook MUST NOT push any toast

#### Scenario: notice fetch failure does not break workspace loading
- **WHEN** `takeWorkspacesRecoveryNotice` rejects on mount
- **THEN** the workspaces list MUST still load and settle normally

### Requirement: Normal Workspaces Read Behavior MUST NOT Regress

The corruption-recovery path MUST only activate on read/parse failure; the success path MUST keep all existing read behavior, including default workspace entry dedupe and the dedupe writeback fallback.

#### Scenario: valid workspaces file still reads unchanged
- **WHEN** `workspaces.json` is valid
- **THEN** load MUST apply the existing read and dedupe rules unchanged
- **AND** no backup file MUST be created

### Requirement: Corrupted workspace backups MUST use unique targets

Each successful `workspaces.json` quarantine MUST create a new backup target and MUST NOT overwrite or collide with an existing corrupted backup, including repeated recovery attempts within the same second.

#### Scenario: two workspace quarantines occur within one timestamp second
- **WHEN** two corrupted `workspaces.json` files are quarantined before the timestamp second changes
- **THEN** both original byte sequences MUST remain in two distinct `.bak` sibling files
