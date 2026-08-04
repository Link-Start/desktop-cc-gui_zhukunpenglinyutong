## ADDED Requirements

### Requirement: Kimi Grok And OpenCode MUST Use The Shared V2 Durable Pipeline

Kimi CLI、Grok CLI and OpenCode CLI Shared turns MUST use the existing attempt-owned Shared
V2 pipeline. They MUST NOT bypass Tx1、Context Package、Provider-scoped Binding、typed
dispatch receipt、Runtime settlement or canonical commit.

#### Scenario: durable intent precedes newly supported runtime

- **WHEN** a Shared turn targets Kimi、Grok or OpenCode
- **THEN** `conversation.turnRequested` with the full frozen snapshot MUST commit before the
  Native runtime is touched
- **AND** dispatch MUST consume the durable Attempt owner rather than current picker state

#### Scenario: EngineEvent settles the exact Attempt

- **WHEN** a newly supported CLI emits text、reasoning、tool and terminal EngineEvents
- **THEN** events MUST enter the Shared Runtime coordinator under the exact Provider runtime key
- **AND** terminal evidence MUST settle and commit the matching Attempt exactly once

#### Scenario: receipt mismatch fails closed

- **WHEN** runtime receipt Engine、Provider、Model、Reasoning or runtime key differs from the
  durable target snapshot
- **THEN** Shared dispatch MUST enter a visible failure or recovery state
- **AND** MUST NOT accept the Turn or silently route to a default target

#### Scenario: unverified import uses weak user-channel delivery

- **WHEN** Context Package is delivered to Kimi、Grok or OpenCode
- **THEN** the pipeline MUST use user-channel transcript delivery with weak ACK evidence
- **AND** MUST NOT claim structured history import or strong context ACK

#### Scenario: native event remains native without shared owner

- **WHEN** Kimi、Grok or OpenCode emits an EngineEvent without a registered Shared Attempt owner
- **THEN** the existing Native Session event payload and fan-out MUST remain unchanged
- **AND** no Shared canonical fact MUST be created
