## ADDED Requirements

### Requirement: PR Title and Body Auto-Generation

The system SHALL provide AI-generated PR title and body in the Git History Create PR dialog, with a single trigger that fills both fields.

#### Scenario: Single trigger on title field only

- **WHEN** the user opens the Create PR dialog
- **THEN** exactly ONE generate button SHALL appear, adjacent to the PR title input
- **AND** the PR body textarea SHALL NOT have a second generate button
- **AND** clicking the trigger SHALL fill both title and body in one backend roundtrip

#### Scenario: Reuse commit message engine selection

- **WHEN** user opens the generate menu
- **THEN** the menu SHALL list the same engines as the commit message generator (Codex / Claude)
- **AND** the menu SHALL remember the last-used `language` + `engine` configuration via `readLastCommitMessageConfig` / `saveLastCommitMessageConfig`
- **AND** selecting an entry SHALL dispatch to the chosen engine using the same `engineSendMessageSync` path and `autoSession = { sessionPurpose: "pull-request-content", visibility: "hidden", ownerFeature: "git", autoArchive: true, createdBy: "system" }` as the existing `generateCommitMessageWithEngine`

#### Scenario: Write-back always overwrites current values

- **WHEN** AI generation succeeds
- **THEN** the system SHALL overwrite the current PR title with `result.title` (when non-empty)
- **AND** the system SHALL overwrite the current PR body with `result.body` (when non-empty)
- **AND** pre-filled default values (merge commit title / empty body template) SHALL be replaced

#### Scenario: Write-back visual confirmation

- **WHEN** AI generation writes content to the title input or body textarea
- **THEN** the system SHALL render a 1.2s accent-color outline pulse on both fields via `[data-ai-flash-at]` CSS attribute
- **AND** the outline SHALL auto-dismiss after 1.2s

#### Scenario: Structured JSON output

- **WHEN** the AI engine responds
- **THEN** the system SHALL parse a JSON object with `title` and `body`
- **AND** tolerant parsing SHALL accept strict JSON, then a string/escape-aware first balanced `{...}` block
- **AND** invalid or incomplete structured output SHALL fail closed without writing raw model text to the form

#### Scenario: Title length cap

- **WHEN** the AI-generated title exceeds 72 characters
- **THEN** the system SHALL truncate the title to at most 72 characters and trim trailing whitespace / punctuation

#### Scenario: Diff size cap

- **WHEN** the workspace diff between `baseBranch` and `headBranch` exceeds 20000 characters
- **THEN** the system SHALL truncate the diff fed to the prompt to 20000 characters
- **AND** the prompt SHALL include a `... (diff truncated for prompt length)` marker

#### Scenario: Frontend 5-minute hard timeout

- **WHEN** the AI engine does not respond within 300 seconds
- **THEN** the frontend service SHALL reject with a localized "AI generation timed out" error
- **AND** the loading state SHALL reset
- **AND** the user SHALL be able to retry

#### Scenario: 60-second soft warning

- **WHEN** the AI engine has not responded within 60 seconds
- **THEN** the frontend service SHALL emit `onProgress({ kind: "soft-warn" })`
- **AND** the UI SHALL switch the progress pill to an amber "diff large, please wait" state
- **AND** the elapsed-second counter SHALL continue ticking every second

#### Scenario: Engine execution policy parity

- **WHEN** the chosen engine is not in the supported engine execution set
- **THEN** the system SHALL reject with `unsupported_engine` error identical to commit message generation

#### Scenario: Missing base or head branch

- **WHEN** the user clicks the generate button
- **AND** `baseBranch` or `headBranch` is empty
- **THEN** the trigger button SHALL be disabled with a tooltip explaining the prerequisite
- **AND** the `historyGeneratePrMissingBaseOrHead` i18n key SHALL be surfaced in the error pill

#### Scenario: Success pill shows actual engine

- **WHEN** AI generation succeeds
- **THEN** the system SHALL display a green success pill `historyGeneratePrSuccessWithEngine` with `{{engine}}` interpolated to the engine that was actually used (`Claude` / `Codex` / `Kimi` / `OpenCode` / `Gemini`)
- **AND** the pill SHALL auto-dismiss after 3 seconds

### Requirement: Hidden Auto-Session for PR Content Generation

The system SHALL spawn a hidden, auto-archived session for PR content generation when using non-Codex engines.

#### Scenario: Non-Codex engine auto-session

- **WHEN** the chosen engine is Claude (or other non-Codex engine)
- **THEN** the system SHALL pass `autoSession = { sessionPurpose: "pull-request-content", visibility: "hidden", ownerFeature: "git", autoArchive: true, createdBy: "system" }` to the engine send API

### Requirement: PR Content Generation Diff Context

The system SHALL collect the committed PR range used by the PR preview to provide context for PR content generation.

#### Scenario: Diff collection parity

- **WHEN** the AI generator runs
- **THEN** the frontend SHALL pass the same resolved refs used by PR preview (`<upstreamRemote>/<baseBranch>` and the selected head ref)
- **AND** the system SHALL execute a committed range diff equivalent to `git diff --no-color --find-renames <resolvedBaseRef>...<resolvedHeadRef>`
- **AND** the diff SHALL be embedded in the prompt along with `baseBranch` and `headBranch` labels

#### Scenario: Empty diff rejection

- **WHEN** the workspace has no diff between `baseBranch` and `headBranch`
- **THEN** the system SHALL return the error `No changes to generate pull request content for`

#### Scenario: Remote mode fails closed

- **WHEN** the desktop client is configured to forward Git commands to a remote daemon
- **THEN** PR content generation SHALL reject with a stable unavailable-in-remote-mode error
- **AND** the desktop command SHALL NOT forward an unimplemented daemon method
