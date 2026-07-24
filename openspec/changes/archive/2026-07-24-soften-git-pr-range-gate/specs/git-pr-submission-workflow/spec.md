## ADDED Requirements

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
