## ADDED Requirements

### Requirement: Context Package Identity MUST Cover Compilation Decisions

Context Compiler MUST derive `packageId` from every stable input that can change package mode or payload, including compiler version, destination, runtime capabilities, effective budget, binding, source range and source checksum.

#### Scenario: Capability changes package identity
- **WHEN** the same source range and binding are compiled with different runtime capabilities
- **THEN** the resulting Context Packages have different `packageId` values

#### Scenario: Identical compilation stays deterministic
- **WHEN** all source and compilation inputs are identical
- **THEN** the resulting Context Packages and `packageId` values are byte-for-byte deterministic
