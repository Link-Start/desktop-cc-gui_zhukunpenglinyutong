# large-file-modularization-governance Delta Spec

## MODIFIED Requirements

### Requirement: Oversized File Detection Baseline

The system SHALL maintain version-traceable baseline artifacts for large-file governance, including a human-readable report and a machine-readable debt ledger keyed by the matched governance policy.

#### Scenario: New-file ratchet baseline capture
- **WHEN** the large-file governance scanner runs in `new-file` scope
- **THEN** every governed file whose line count exceeds the configured `newFileFailThreshold` MUST be recorded with path, line count, matched policy id, warn threshold, effective fail threshold, and priority tier
- **AND** the machine-readable ratchet baseline MUST be committed separately from the hard-debt baseline so current 800+ files are not confused with policy fail-threshold hard debt

### Requirement: Large-File Regression Sentry

The system SHALL provide CI sentry checks that enforce domain-aware hard gates and baseline-aware debt growth controls, while keeping near-threshold watch output visible for triage.

#### Scenario: Hard gate for new ratchet debt
- **WHEN** a pull request introduces a governed file whose line count exceeds `newFileFailThreshold`
- **AND** the file is absent from the committed new-file ratchet baseline
- **THEN** CI sentry MUST fail the hard gate
- **AND** the failure output MUST classify the finding as `status=new` and `threshold=new-file-ratchet`

#### Scenario: Current ratchet baseline files keep legacy hard-debt semantics
- **WHEN** a file is present in the new-file ratchet baseline and remains below its matched policy fail threshold
- **THEN** CI sentry MUST NOT fail solely because the file exceeds `newFileFailThreshold`
- **AND** if that file later exceeds the matched policy fail threshold, the existing hard-debt baseline semantics MUST still classify it as new, retained, reduced, or regressed according to the hard-debt baseline
