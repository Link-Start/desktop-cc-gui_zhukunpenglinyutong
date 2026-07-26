# model-provider-catalog-runtime Specification

## Purpose
TBD - created by archiving change converge-model-provider-catalog-runtime. Update Purpose after archive.
## Requirements
### Requirement: Catalog Sources MUST Follow One Deterministic Precedence

Every engine model catalog MUST merge sources in `runtime > configured > cached > generated fallback` order with deterministic dedupe.

#### Scenario: runtime and fallback contain same model

- **WHEN** runtime discovery returns a model also present in generated fallback
- **THEN** runtime metadata MUST win
- **AND** the model MUST appear once

### Requirement: Provider And Protocol MUST Be Orthogonal Metadata

Catalog entries MUST carry provider identity separately from API/wire protocol and MUST preserve source/provenance across Rust、daemon and TypeScript DTOs.

#### Scenario: backend knows provider

- **WHEN** CLI output or config resolves provider/model
- **THEN** frontend MUST receive provider metadata
- **AND** it MUST NOT reclassify the model from a prefix table

### Requirement: Refresh Failure MUST Preserve Last-Good Catalog

Catalog refresh MUST replace cache only after successful validation; failure MUST return last-good entries with stale/error metadata.

#### Scenario: runtime discovery fails

- **WHEN** a previous successful catalog exists
- **THEN** the previous catalog MUST remain selectable
- **AND** UI MUST expose stale/error state without clearing entries

### Requirement: Generated Fallback MUST Have One Owner And Freshness Evidence

Each engine MUST have one generated fallback roster with source、lifecycle and last verification metadata.

#### Scenario: duplicate fallback owners diverge

- **WHEN** frontend and backend fallback rosters differ
- **THEN** the catalog parity gate MUST fail
