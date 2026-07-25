## ADDED Requirements

### Requirement: Backend Settings Load MUST Preserve Corrupted Files Before Fallback

When `settings.json` cannot be read or parsed, the GUI `AppState::load` and daemon `DaemonState::load` MUST rename the corrupted file to a timestamped backup (for example `settings.json.corrupted-<UTC timestamp>.bak`) before falling back to `AppSettings::default()`, and MUST emit a log line describing the failure and the backup outcome. A subsequent settings save MUST NOT overwrite the user's original corrupted content.

#### Scenario: corrupted settings file is quarantined before default fallback
- **WHEN** `settings.json` exists but contains invalid JSON
- **THEN** backend load MUST rename it to a `.corrupted-<timestamp>.bak` sibling file with the original bytes preserved
- **AND** load MUST fall back to default settings with a `[storage]` log line
- **AND** a later `write_settings` MUST create a fresh `settings.json` rather than destroying the corrupted original

#### Scenario: missing settings file keeps first-run behavior
- **WHEN** `settings.json` does not exist
- **THEN** backend load MUST return default settings without creating any backup file and without logging a corruption warning

### Requirement: Frontend Settings Load Failure MUST Be Visible

The `useAppSettings` load `catch` branch MUST NOT be silent: it MUST emit an error log and MUST surface a user-visible notice through the existing `pushErrorToast` service, while keeping default settings in place and settling `isLoading`.

#### Scenario: settings load rejection surfaces a toast
- **WHEN** `getAppSettings` rejects during initial load
- **THEN** the hook MUST keep default settings and settle `isLoading` to false
- **AND** it MUST emit a `console.error` log
- **AND** it MUST push exactly one error toast via the shared toasts service

### Requirement: Normal Settings Normalization MUST NOT Regress

The corruption-recovery path MUST only activate on read/parse failure; the success path MUST keep all existing normalization behavior, including legacy Gemini enablement normalization to disabled and startup upgrade rules.

#### Scenario: valid legacy settings still normalize on load
- **WHEN** `settings.json` is valid and contains legacy values such as `geminiEnabled: true`
- **THEN** load MUST apply the existing normalization rules unchanged
- **AND** no backup file MUST be created
