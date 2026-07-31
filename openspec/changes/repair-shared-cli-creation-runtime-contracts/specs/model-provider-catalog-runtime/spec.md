## ADDED Requirements

### Requirement: OpenCode Shared Validation MUST Reuse Runtime Catalog Authority

OpenCode local Model discovery and Shared create/send validation MUST use the same last-known-good runtime catalog authority. A successful `opencode models` discovery MUST update the catalog snapshot used by synchronous Shared validation. A failed refresh MUST NOT erase a previous successful snapshot, and generated catalog data MAY only be used as fallback when no runtime snapshot exists.

#### Scenario: runtime-only OpenCode Model remains valid

- **WHEN** `opencode models` returns a Model that is absent from the generated fallback
- **AND** the user selects that Model for a Shared Session
- **THEN** Shared creation and subsequent send validation MUST accept the exact catalog entry/runtime Model pair

#### Scenario: failed refresh preserves last-known-good catalog

- **WHEN** OpenCode runtime discovery previously succeeded and a later refresh fails
- **THEN** the last-known-good runtime catalog MUST remain the validation authority
- **AND** the system MUST NOT silently replace it with a smaller generated fallback
