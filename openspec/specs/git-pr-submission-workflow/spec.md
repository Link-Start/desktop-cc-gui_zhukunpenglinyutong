# git-pr-submission-workflow Specification

## Purpose

Defines the git-pr-submission-workflow behavior contract, covering Structured GitHub PR Workflow.
## Requirements
### Requirement: Structured GitHub PR Workflow

The system SHALL provide a structured GitHub PR workflow from the Git panel with explicit parameter confirmation and
staged execution feedback.

#### Scenario: Run workflow after parameter confirmation

- **WHEN** user confirms Create PR parameters
- **THEN** workflow SHALL execute stages in order: `precheck -> push -> create -> comment`
- **AND** UI SHALL receive stage statuses as structured payload

#### Scenario: Comment step failure does not invalidate PR creation

- **WHEN** PR is created successfully but comment step fails
- **THEN** workflow overall result SHALL remain successful for PR creation
- **AND** comment stage SHALL be marked failed/skipped with diagnostic detail

### Requirement: Existing PR Reuse

The workflow SHALL detect and reuse existing PRs for the same head reference before creating a new PR.

#### Scenario: Existing PR found by head reference

- **WHEN** workflow queries existing PRs with same `<head owner>:<head branch>`
- **THEN** system SHALL skip create step and return `status=existing`
- **AND** response SHALL include existing PR metadata (`number/title/url/state`)

### Requirement: Actionable Workflow Result Payload

The workflow SHALL return a complete result payload for success/failure handling.

#### Scenario: Success payload

- **WHEN** workflow succeeds (new or existing PR)
- **THEN** result SHALL include `prUrl` and optional `prNumber`
- **AND** result SHALL include stage details for UI review

#### Scenario: Failure payload

- **WHEN** workflow fails in any stage
- **THEN** result SHALL include `errorCategory` and `nextActionHint`
- **AND** push-related failures SHALL provide `retryCommand` when applicable

### Requirement: Remote Backend GitHub Panels and PR Workflow

GitHub Issues, Pull Requests, pull request diffs/comments, PR workflow defaults, and PR creation workflow SHALL execute against the active backend location. In remote daemon mode, desktop commands for these GitHub-backed features MUST delegate to daemon RPC so repository remote detection, GitHub token/environment, and Git state are evaluated on the daemon side.

#### Scenario: Remote GitHub issue and pull request reads use daemon context

- **WHEN** the app is in remote daemon mode and the GitHub panel loads issues, pull requests, PR diffs, or PR comments
- **THEN** desktop commands MUST call matching daemon RPC methods
- **AND** repository and GitHub context MUST be resolved on the daemon side

#### Scenario: Remote PR workflow uses daemon context

- **WHEN** the app is in remote daemon mode and PR workflow defaults or PR creation workflow are requested
- **THEN** desktop commands MUST call daemon RPC for those workflow methods
- **AND** branch, remote, and GitHub metadata MUST reflect the daemon-side repository

#### Scenario: Local GitHub behavior remains unchanged

- **WHEN** the app is in local backend mode and GitHub panel or PR workflow commands run
- **THEN** existing local behavior, return shape, and error semantics MUST be preserved

### Requirement: Explicit Large Range Authorization Contract

The Create PR workflow SHALL represent large-range confirmation as a typed, one-shot request/result contract across local and remote backends.

#### Scenario: Confirmation metadata is returned

- **WHEN** changed-file count exceeds the normal Range Gate threshold without authorization
- **THEN** result SHALL include changed-file count, threshold, severity, `requiresConfirmation=true`, and an opaque fingerprint for the evaluated base/head revisions
- **AND** client SHALL NOT infer confirmation from human-readable error text

#### Scenario: Authorized retry recomputes current range

- **WHEN** user confirms the large-range warning
- **THEN** client SHALL retry with one-shot `allowLargeRange` authorization and the confirmed range fingerprint
- **AND** backend SHALL fetch and recompute `upstream/<base>...HEAD` before continuing
- **AND** a fingerprint mismatch SHALL return a new confirmation requirement instead of continuing to push/create

#### Scenario: Remote backend preserves authorization contract

- **WHEN** PR workflow runs through daemon forwarding
- **THEN** request SHALL preserve `allowLargeRange` and the confirmed range fingerprint
- **AND** response SHALL preserve the complete Range Gate metadata
- **AND** daemon fetch/diff/revision failures SHALL settle as a bounded structured precheck failure

### Requirement: PR Form Prefill Source Awareness

The PR workflow SHALL treat form fields (title, body) as authoritative regardless of how they were filled.

#### Scenario: AI-generated title flows through unchanged

- **WHEN** the AI generator fills the title and body
- **AND** the user submits the Create PR workflow
- **THEN** the workflow SHALL use the current form values verbatim
- **AND** no automatic rewrite SHALL occur after submission

#### Scenario: Editable after AI fill

- **WHEN** the AI generator fills the title and body
- **THEN** the user SHALL remain able to edit either field freely
- **AND** subsequent edits SHALL be preserved on submit

#### Scenario: Write-back overwrites defaults

- **WHEN** the AI generator fills the title and body
- **AND** the form previously held pre-filled default values (merge commit title / empty body template)
- **THEN** the AI content SHALL replace the defaults unconditionally
- **AND** a 1.2s outline flash SHALL appear on both fields to make the change visible

