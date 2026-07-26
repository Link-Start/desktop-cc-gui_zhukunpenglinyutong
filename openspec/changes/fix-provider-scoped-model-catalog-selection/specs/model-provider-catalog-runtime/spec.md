## MODIFIED Requirements

### Requirement: Catalog Sources MUST Follow One Deterministic Precedence

Every engine model catalog MUST merge sources in `provider-owned runtime/configured > public user-configured > public generated fallback` order with deterministic dedupe. For a managed provider request, disk/global provider-specific configured entries MUST NOT be treated as public entries. Dedupe MUST use normalized runtime model identity, falling back to model ID when no runtime value exists.

#### Scenario: provider and public catalog contain same model

- **WHEN** a managed provider model and a public model resolve to the same normalized runtime model identity
- **THEN** the provider-owned metadata and label MUST win
- **AND** the model MUST appear once

#### Scenario: provider catalog appends public models

- **WHEN** a managed Claude Code, Codex, or Kimi provider catalog is requested
- **THEN** the result MUST include models configured by that provider
- **AND** it MUST append public user-configured and generated fallback models that do not duplicate provider models
- **AND** it MUST NOT include configured models owned only by another managed provider or by the disk/global provider

#### Scenario: local profile preserves global catalog

- **WHEN** the request omits `providerProfileId` or identifies the engine's local/disk profile
- **THEN** the system MUST preserve the existing disk/global model catalog behavior
- **AND** it MUST NOT reinterpret the local profile as a managed isolated catalog

### Requirement: Provider And Protocol MUST Be Orthogonal Metadata

Catalog entries MUST carry provider identity separately from API/wire protocol and MUST preserve source/provenance across Rust、daemon and TypeScript DTOs. Provider catalog request scope MUST remain a separate `providerProfileId` fact and MUST NOT be inferred from model name prefixes.

#### Scenario: backend knows provider profile scope

- **WHEN** `get_engine_models` receives a managed `providerProfileId`
- **THEN** Desktop and daemon adapters MUST pass that exact scope to provider config resolution
- **AND** frontend cache and in-flight request identity MUST include `engineType + providerProfileId`
- **AND** the frontend MUST NOT reclassify the scope from a model prefix table

#### Scenario: managed profile is missing

- **WHEN** a requested managed provider profile no longer exists or its model configuration is invalid
- **THEN** model catalog resolution MUST return a diagnosable provider-scoped error
- **AND** it MUST NOT silently retry with the local/disk profile

### Requirement: Refresh Failure MUST Preserve Last-Good Catalog

Catalog refresh MUST replace cache only after successful validation; failure MUST retain last-good entries with error diagnostics. A stale response for a previously active provider scope MUST NOT replace the currently active scope.

#### Scenario: provider refresh fails

- **WHEN** a previous successful provider-scoped catalog exists
- **AND** refreshing that provider fails
- **THEN** the previous catalog MUST remain selectable
- **AND** diagnostics MUST identify the engine and provider scope

#### Scenario: provider responses arrive out of order

- **WHEN** the user switches from provider A to provider B before A's catalog request completes
- **AND** provider A responds after provider B
- **THEN** provider A's response MUST NOT replace provider B's visible catalog
- **AND** each provider request/cache identity MUST remain independent
