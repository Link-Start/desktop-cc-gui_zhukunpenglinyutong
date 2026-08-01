## ADDED Requirements

### Requirement: Shared history convergence MUST preserve transcript completeness monotonically

Canonical identity is authoritative for execution metadata, but canonical text MUST NOT downgrade a more complete Legacy presentation transcript. When two assistant facts in the same Turn have a strict normalized prefix relationship, dual-read convergence MUST retain the more complete body while merging canonical identity.

#### Scenario: truncated canonical prefix does not overwrite Legacy final
- **WHEN** a Legacy assistant final contains complete text and the matching canonical assistant contains only a strict prefix
- **THEN** history convergence MUST retain the complete Legacy body
- **AND** the result MUST retain canonical execution target metadata

#### Scenario: complete canonical final upgrades Legacy prefix
- **WHEN** a Legacy assistant contains only a streaming prefix and canonical contains the matching complete final
- **THEN** history convergence MUST retain the complete canonical body
- **AND** MUST produce one assistant final

#### Scenario: unrelated assistant bodies are not collapsed
- **WHEN** canonical and Legacy assistant bodies in a Turn have no normalized prefix or equivalence relationship
- **THEN** convergence MUST NOT discard either body merely by comparing length
