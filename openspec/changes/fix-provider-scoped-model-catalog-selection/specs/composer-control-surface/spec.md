## MODIFIED Requirements

### Requirement: Provider Groups MUST Use Provider-Scoped Model Catalogs

The grouped Composer model selector MUST resolve each engine group from provider-scoped catalog facts rather than treating the active engine `models` array as the catalog for every provider. When the active thread has a persisted managed provider binding, its active engine group MUST contain only that provider's configured models plus public models, with deterministic dedupe.

#### Scenario: active managed provider uses its catalog

- **WHEN** a new or restored Claude Code, Codex, or Kimi thread has managed `providerProfileId=A`
- **THEN** the active engine model group MUST use provider A's configured models
- **AND** it MUST append public models
- **AND** it MUST NOT include models owned only by provider B or the disk/global provider

#### Scenario: provider and public model duplicate

- **WHEN** the active provider catalog and public catalog contain the same runtime model identity
- **THEN** the selector MUST show one row
- **AND** the provider-owned label and metadata MUST take precedence

#### Scenario: provider-scoped Codex model preserves reasoning capabilities

- **WHEN** a provider-scoped Codex model matches an authoritative Codex catalog row by normalized runtime model identity
- **THEN** missing `supportedReasoningEfforts` and `defaultReasoningEffort` MUST be inherited from the authoritative row
- **AND** provider-owned label, origin, profile binding, and explicit reasoning metadata MUST remain authoritative
- **AND** an unmatched provider-only model MUST NOT receive inferred reasoning capabilities

#### Scenario: user selects an arbitrary provider-bound Codex model

- **WHEN** an active provider-bound Codex thread stores a non-empty user-selected model name
- **THEN** Composer MUST preserve the selected model without requiring membership in the current or global Codex catalog
- **AND** temporary catalog loading, refresh, or absence MUST NOT invalidate the selection
- **AND** selection repair MUST NOT replace it with a global/default model
- **AND** blank model names MUST continue through the existing fallback path

#### Scenario: user selects an arbitrary provider-bound Claude Code model

- **WHEN** an active provider-bound Claude Code thread stores a non-empty user-selected model name
- **THEN** Composer MUST preserve the selected model without requiring membership in the current Claude catalog
- **AND** temporary catalog loading, refresh, or absence MUST NOT invalidate the model or its reasoning effort
- **AND** selection repair MUST NOT replace it with a default model
- **AND** blank model names MUST continue through the existing fallback path

#### Scenario: switching parallel provider sessions updates catalog

- **WHEN** the same workspace contains active sessions bound to different provider profiles
- **AND** the user switches the active session
- **THEN** the selector MUST load and display the newly active session's provider-scoped catalog
- **AND** an older request MUST NOT overwrite the new session's model list

#### Scenario: non-active Claude group has Claude catalog

- **WHEN** the active Composer provider is not `Claude Code`
- **AND** Claude Code has settings/env or user custom model entries
- **THEN** the grouped selector MUST include a Claude Code group
- **AND** that group MUST use Claude Code model entries instead of the active provider's model list

#### Scenario: non-active Codex group has Codex catalog

- **WHEN** the active Composer provider is not `Codex`
- **AND** Codex has built-in, config-derived, runtime, or user custom model entries
- **THEN** the grouped selector MUST include a Codex group
- **AND** that group MUST use Codex model entries instead of the active provider's model list

#### Scenario: provider footer action targets effective provider

- **WHEN** a provider group is rendered in the selector
- **THEN** add-model and refresh-config footer actions MUST remain scoped to the effective selected provider context
- **AND** refreshing a provider group MUST NOT start, stop, or restart a conversation runtime
