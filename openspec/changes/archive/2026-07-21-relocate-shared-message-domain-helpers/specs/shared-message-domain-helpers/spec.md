## ADDED Requirements

### Requirement: Shared diff capability has a neutral owner

All production consumers MUST import diff parsing/computation from `src/utils/diff.ts` or its
public neutral path, and peer features MUST NOT import messages-private diff helpers.

#### Scenario: oversized LCS input

- **WHEN** diff input exceeds the established LCS product guard
- **THEN** computation MUST use the bounded fallback
- **AND** result/stats MUST remain deterministic

#### Scenario: unified patch headers

- **WHEN** stats are derived from a unified patch
- **THEN** `---` and `+++` file headers MUST NOT count as removed/added content

### Requirement: Shared tool semantics are presentation-neutral

Parsers/classifiers/status mappings consumed by three or more features MUST live in a neutral
pure module and MUST NOT depend on React、i18n、messages components or UI policy.

#### Scenario: peer feature classifies a tool

- **WHEN** threads、status-panel、session-activity or operation-facts parses a tool item
- **THEN** it MUST consume the neutral semantics module
- **AND** output MUST match the previous messages-private helper behavior

### Requirement: Agent-task and command contracts use their real owner

Agent-task notification parsing MUST be owned by `engine-task-output/contracts`, and command
message tag parsing MUST be owned by root neutral utilities.

#### Scenario: messages renders agent-task notification

- **WHEN** messages receives an engine-task notification payload
- **THEN** it MUST consume the engine-task-output contract without reverse importing messages

### Requirement: File icon has one shared visual owner

Peer features MUST render file icons through one shared component contract and MUST NOT import
`messages/components/toolBlocks/FileIcon`.

#### Scenario: status panel renders changed files

- **WHEN** status-panel renders file change entries
- **THEN** icon selection and size MUST match the previous UI
- **AND** the import MUST resolve to the shared component owner
