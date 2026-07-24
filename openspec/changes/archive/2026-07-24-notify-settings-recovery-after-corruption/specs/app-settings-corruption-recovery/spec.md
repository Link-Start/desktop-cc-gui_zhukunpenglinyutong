## MODIFIED Requirements

### Requirement: Frontend Settings Load Failure MUST Be Visible

When the initial `getAppSettings` invoke rejects, the `useAppSettings` load `catch` branch MUST NOT be silent: it MUST emit an error log and MUST surface a user-visible notice through the existing `pushErrorToast` service, while keeping default settings in place and settling `isLoading`. The toast copy MUST describe a settings read/invoke failure only; it MUST NOT claim that the backend quarantined or backed up the settings file, because no backup happens on this path. The toast title and message MUST resolve through i18n keys present in at least the `zh` and `en` locale bundles.

#### Scenario: settings load rejection surfaces a toast
- **WHEN** `getAppSettings` rejects during initial load
- **THEN** the hook MUST keep default settings and settle `isLoading` to false
- **AND** it MUST emit a `console.error` log
- **AND** it MUST push exactly one error toast via the shared toasts service

#### Scenario: invoke-failure copy does not claim a backup
- **WHEN** the initial settings invoke rejects (no quarantine has occurred)
- **THEN** the toast message MUST describe a read/connection failure and default fallback only
- **AND** it MUST NOT state or imply that the settings file was backed up

## ADDED Requirements

### Requirement: Backend MUST Record A Corruption Recovery Notice

When the GUI `AppState::load` quarantines a corrupted `settings.json`, it MUST record a recovery notice in memory containing the backup file name (or a null file name when the backup rename itself failed). A dedicated `take_settings_recovery_notice` command MUST return the pending notice and clear it in the same call (take semantics), so the notice can be consumed exactly once. Successful loads MUST NOT record any notice. The daemon `DaemonState` has no UI surface and MUST keep its existing quarantine-only behavior without recording a notice.

#### Scenario: quarantine records a notice with the backup file name
- **WHEN** `settings.json` is corrupted and quarantine renames it to `settings.json.corrupted-<timestamp>.bak`
- **THEN** the recorded notice MUST contain that backup file name
- **AND** the first `take_settings_recovery_notice` call MUST return the notice
- **AND** a subsequent `take_settings_recovery_notice` call MUST return null

#### Scenario: clean startup leaves no notice
- **WHEN** settings load succeeds without corruption
- **THEN** `take_settings_recovery_notice` MUST return null

### Requirement: Frontend MUST Surface The Recovery Notice After A Successful Load

After `getAppSettings` resolves successfully, `useAppSettings` MUST call `takeSettingsRecoveryNotice` exactly once per load. When a notice is returned, it MUST push exactly one localized toast whose message names the backup file (or uses the backup-failed copy when the file name is null). Toast title and message MUST resolve through i18n keys present in at least the `zh` and `en` locale bundles; other languages fall back to English. A failure of the notice fetch itself MUST NOT break or roll back the successful settings load.

#### Scenario: successful load with a pending notice surfaces one toast
- **WHEN** settings load succeeds and the backend holds a recovery notice with a backup file name
- **THEN** the hook MUST push exactly one toast via the shared toasts service
- **AND** the toast message MUST contain the backup file name

#### Scenario: successful load without a notice stays silent
- **WHEN** settings load succeeds and no recovery notice is pending
- **THEN** the hook MUST NOT push any toast

#### Scenario: notice fetch failure does not break the load
- **WHEN** settings load succeeds but `takeSettingsRecoveryNotice` rejects
- **THEN** loaded settings MUST remain in place and `isLoading` MUST settle to false
