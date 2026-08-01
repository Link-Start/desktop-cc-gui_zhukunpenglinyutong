# engine-adapter-protocol-registry Specification

## Purpose
TBD - created by archiving change define-engine-adapter-protocol-registry. Update Purpose after archive.
## Requirements
### Requirement: Engine Adapter And Protocol Responsibilities MUST Be Separate

`EngineProtocol` MUST own executable/process/wire behavior; `EngineAdapter` MUST own engine identity、capability、session and delivery semantics.

#### Scenario: protocol output is interpreted

- **WHEN** a protocol parser produces normalized wire output
- **THEN** the bound adapter MUST map it to engine domain events
- **AND** protocol code MUST NOT mutate frontend session state

### Requirement: Registry MUST Support Typed Built-Ins And Extensible Engine Identities

Built-in engines MUST retain exhaustive Rust typing while registry APIs use a stable opaque `EngineId` capable of representing validated external registrations.

#### Scenario: built-in engine is registered

- **WHEN** the registry initializes a built-in adapter
- **THEN** its TypeScript、Rust and daemon identity MUST pass parity validation

#### Scenario: external engine is registered

- **WHEN** a future trusted plugin registers an external engine
- **THEN** registration MUST validate schema、source and capabilities
- **AND** it MUST NOT require adding a variant to the built-in enum

### Requirement: Registry Entries MUST Carry Provenance And Runtime Availability Separately

Static entry metadata MUST include source/provenance and declared capability; mutable runtime availability MUST be updated separately.

#### Scenario: executable becomes unavailable

- **WHEN** a registered engine executable disappears
- **THEN** runtime availability MUST change
- **AND** registry identity/provenance MUST remain stable

### Requirement: Runtime Manager MUST Own Handle Generations

Live session handles MUST be created、replaced、rebound、aborted and torn down by one runtime manager.

#### Scenario: session handle is replaced

- **WHEN** a session receives a new runtime generation
- **THEN** operations against the previous handle MUST fail as stale
- **AND** previous process/listener resources MUST be released
