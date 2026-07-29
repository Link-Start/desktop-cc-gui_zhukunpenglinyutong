## ADDED Requirements

### Requirement: Shared Execution Target MUST Support Five Provider-scoped CLIs

Shared `ExecutionTarget`、Binding Key、mutable selection、frozen snapshot and owner routing MUST
support Claude Code、Codex CLI、Kimi CLI、Grok CLI and OpenCode CLI with the same Provider
provenance contract.

#### Scenario: newly supported CLI target survives reload

- **WHEN** a user selects a resolved Kimi、Grok or OpenCode Target and reloads the Shared Session
- **THEN** the complete Engine、Provider、Model and Reasoning selection MUST be restored
- **AND** no field MAY be rewritten from global Engine or Model state

#### Scenario: same CLI with two Providers owns two bindings

- **WHEN** Shared turns target two managed Providers under Kimi、Grok or OpenCode
- **THEN** the system MUST persist two distinct `engine + providerProfileId` bindings
- **AND** switching back MUST reuse the original binding

#### Scenario: local profile freezes canonical local provenance

- **WHEN** a Kimi、Grok or OpenCode local Profile is selected
- **THEN** mutable selection MUST use `providerProfileId=null + providerProfileSource=disk`
- **AND** the frozen canonical snapshot MUST use `providerProfileSource=local`
