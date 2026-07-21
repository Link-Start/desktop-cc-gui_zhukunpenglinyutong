## ADDED Requirements

### Requirement: Messages dependency direction

The system SHALL expose messages through one public API and SHALL prevent peer
features from importing messages private components, utilities, types, constants,
presentation modules, or rendering internals.

#### Scenario: Existing private import debt is unchanged

- **WHEN** the boundary checker analyzes the measured Phase 0 baseline
- **THEN** every existing private import SHALL match one exact allowlist entry
- **AND** the checker SHALL exit successfully without creating wildcard exceptions

#### Scenario: A new private deep import is introduced

- **WHEN** any source or test outside messages adds an unlisted import of a messages private path
- **THEN** the boundary checker SHALL fail and report its source file, line, import kind, and specifier

#### Scenario: Existing debt is removed

- **WHEN** an allowlisted private import is deleted or migrated to the public API
- **THEN** the boundary checker SHALL continue to pass and report the removed debt count

### Requirement: Messages peer-feature coupling does not grow

The system SHALL maintain an exact measured baseline of messages imports from peer
features and SHALL reject any new or duplicated peer-feature import beyond that baseline.

#### Scenario: A new peer-feature dependency is introduced

- **WHEN** a messages source or test adds an unlisted import from another `src/features/*` owner
- **THEN** the boundary checker SHALL fail with the new directed dependency evidence

### Requirement: Streaming architecture preservation

The system SHALL preserve the stable timeline snapshot and live row override lanes.

#### Scenario: Governance gate is installed

- **WHEN** Phase 0 artifacts and static checks are added
- **THEN** no messages production component, state owner, virtualization behavior, or streaming subscription SHALL change

### Requirement: Async media scope safety

The system SHALL reject deferred-media completions from stale workspace, thread,
message, or locator scopes and SHALL release renderer-owned object URLs.

#### Scenario: Later implementation changes deferred media ownership

- **WHEN** a deferred-media request completes after its workspace, thread, message, locator, or generation becomes stale
- **THEN** the completion SHALL NOT update current row state
- **AND** any renderer-owned transient object URL SHALL be released

### Requirement: Governance evidence is reproducible

The change SHALL record exact dependency inventory, baseline command outcomes, strict
OpenSpec validation, and a negative fixture test proving that unlisted debt fails.

#### Scenario: Phase 0 completion is audited

- **WHEN** reviewers inspect `verification.md` and rerun the package script
- **THEN** inventory counts SHALL match the embedded checker baseline
- **AND** no temporary fixture SHALL remain in the worktree
