## ADDED Requirements

### Requirement: Runtime Capability Query MUST Preserve Independent Evidence Dimensions

Runtime capability lookup MUST return matrix stance、policy enablement、runtime availability 与 compatibility reason as independent fields and MUST NOT collapse missing transport fields into `unsupported`.

#### Scenario: known Rust capability crosses the DTO boundary

- **WHEN** Rust declares an engine capability and serializes engine status
- **THEN** TypeScript MUST receive the semantically equivalent field
- **AND** the capability MUST NOT become `unknown` or `unsupported` because of naming mismatch

#### Scenario: policy disables a supported capability

- **WHEN** matrix stance is `supported` but current product policy disables the capability
- **THEN** runtime query MUST preserve `supported` as the stance
- **AND** it MUST return `policyEnabled=false` with an explainable reason

### Requirement: Production Capability Artifacts MUST Be Generated From The Spec Matrix

Production frontend、Rust 与 daemon code MUST consume generated runtime artifacts or typed projections derived from the OpenSpec matrix and MUST NOT import governance fixtures directly into the production bundle.

#### Scenario: generated artifacts drift

- **WHEN** the spec matrix changes without regenerating every production artifact
- **THEN** `npm run check:engine-capability-matrix` MUST fail
- **AND** CI MUST identify the drifting engine/capability cell

### Requirement: Foundation Capability Domains MUST Be Runtime Queryable

The matrix MUST support `input.mid-turn`、session resume/fork/switch/tree and RPC readiness keys before delivery、session registry or external engine registration consumers rely on them.

#### Scenario: engine cannot accept mid-turn input

- **WHEN** an engine protocol has no writable mid-turn input channel
- **THEN** `input.mid-turn` MUST resolve to `unsupported`
- **AND** message delivery MUST NOT report steering as accepted

#### Scenario: capability evidence is unavailable

- **WHEN** runtime readiness cannot be probed
- **THEN** the query MUST return `unknown` with evidence reason
- **AND** consumers MUST fail closed without rewriting the matrix stance
