## ADDED Requirements

### Requirement: Create PR Large Range Confirmation

The Create PR dialog SHALL allow explicit confirmation for a large but structurally valid PR range without presenting the confirmation request as a generic operation failure.

#### Scenario: User confirms 241 to 300 changed files

- **WHEN** backend requests `large` Range Gate confirmation
- **THEN** panel SHALL show the evaluated `upstream/<base>...HEAD` context, push target, changed-file count, and review-risk warning
- **AND** confirmation SHALL retry the workflow with one-shot authorization bound to the returned range fingerprint

#### Scenario: User confirms more than 300 changed files

- **WHEN** backend requests `diff-incomplete` Range Gate confirmation
- **THEN** panel SHALL explicitly warn that GitHub may not display the complete diff
- **AND** confirmation SHALL retry the workflow with one-shot authorization bound to the returned range fingerprint

#### Scenario: User cancels large range confirmation

- **WHEN** user declines the Range Gate confirmation
- **THEN** panel SHALL stop before push/create
- **AND** panel SHALL NOT show a generic retry-error notice
