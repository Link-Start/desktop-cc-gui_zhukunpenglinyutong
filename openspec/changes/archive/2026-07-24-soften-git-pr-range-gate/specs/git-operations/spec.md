## MODIFIED Requirements

### Requirement: Preconditions and Range Gate

The workflow SHALL validate operational readiness and classify PR range risk before PR creation.

#### Scenario: GitHub CLI readiness

- **WHEN** workflow enters precheck stage
- **THEN** backend SHALL verify `gh --version` and `gh auth status`
- **AND** readiness failure SHALL return actionable message, not generic unknown error

#### Scenario: Safe upstream range passes

- **WHEN** `upstream/<base>...HEAD` contains between 1 and 240 changed files and has no structural anomaly
- **THEN** backend SHALL pass the Range Gate without additional confirmation
- **AND** workflow SHALL continue to push/create stages

#### Scenario: Large upstream range requires confirmation

- **WHEN** `upstream/<base>...HEAD` contains between 241 and 300 changed files and has no structural anomaly
- **THEN** backend SHALL return a structured confirmation requirement before push/create
- **AND** an explicit one-shot large-range authorization SHALL allow a fresh precheck to continue

#### Scenario: Diff-incomplete upstream range requires stronger confirmation

- **WHEN** `upstream/<base>...HEAD` contains more than 300 changed files and has no structural anomaly
- **THEN** backend SHALL warn that GitHub may not display the complete diff
- **AND** an explicit one-shot large-range authorization SHALL allow a fresh precheck to continue

#### Scenario: Structural range anomaly remains blocked

- **WHEN** the range is empty or matches the suspicious root/base heuristic
- **THEN** backend SHALL block workflow before push/create with clear guidance
- **AND** large-range authorization MUST NOT bypass the block
