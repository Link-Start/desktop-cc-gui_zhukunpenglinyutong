## ADDED Requirements

### Requirement: Claude Model Mapping Storage MUST Converge To One Canonical Key

Claude model mapping MUST write only the canonical storage key; legacy keys MUST be read only by an idempotent migration.

#### Scenario: canonical and legacy values coexist

- **WHEN** canonical storage contains a valid newer value
- **THEN** migration MUST preserve canonical value
- **AND** legacy data MUST NOT overwrite it

#### Scenario: only legacy value exists

- **WHEN** a valid legacy mapping exists and canonical value is absent
- **THEN** migration MUST write canonical value once
- **AND** repeated migration MUST produce the same result

### Requirement: Claude Provider Actions MUST Propagate Typed Errors

Provider load、save、switch、delete and migration operations MUST return typed success/error results with actionable context.

#### Scenario: backend save fails

- **WHEN** provider persistence returns an error
- **THEN** UI MUST not report success
- **AND** the user MUST receive an actionable error while durable state remains authoritative

#### Scenario: legacy cleanup fails after canonical write

- **WHEN** canonical migration succeeds but deleting a legacy key fails
- **THEN** canonical success MUST remain
- **AND** diagnostics MUST expose cleanup warning
