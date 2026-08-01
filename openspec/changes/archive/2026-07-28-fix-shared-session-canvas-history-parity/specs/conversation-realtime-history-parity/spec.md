## ADDED Requirements

### Requirement: Shared realtime and history MUST preserve reasoning parity

Shared Session MUST preserve normalized reasoning facts across realtime rendering, snapshot persistence, canonical/legacy dual-read, and history reload. History convergence MUST use the same Conversation assembler equivalence semantics as Native Session and MUST NOT drop a reasoning fact merely because the canonical projection lacks that fact.

#### Scenario: realtime reasoning survives shared history reload
- **WHEN** a Shared Turn renders one or more reasoning items in realtime and the Shared snapshot persists those items
- **THEN** reopening the Shared Session MUST render the same reasoning facts in the same Turn order
- **AND** canonical identity overlay MUST NOT remove those reasoning facts

#### Scenario: canonical and legacy reasoning do not duplicate
- **WHEN** equivalent reasoning exists in both canonical projection and Legacy presentation snapshot
- **THEN** history convergence MUST produce one equivalent reasoning fact
- **AND** MUST preserve the more complete visible content
