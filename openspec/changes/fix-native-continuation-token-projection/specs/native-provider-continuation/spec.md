## ADDED Requirements

### Requirement: Native Continuation MUST Export The Effective History Window

Native Provider Continuation MUST materialize the effective vendor history at the frozen cursor.
For Codex rollout history, a valid persisted compaction replacement MUST supersede entries from
older windows; entries appended after that compaction MUST remain eligible for export. The reader
MUST NOT modify the source history.

#### Scenario: Codex rollout contains multiple compactions

- **WHEN** a frozen Codex rollout contains one or more valid `compacted` records
- **THEN** the reader MUST use the last valid `replacement_history` as the effective base
- **AND** MUST append portable records after that compaction
- **AND** MUST NOT export entries that only belong to superseded windows

#### Scenario: compaction replacement contains private state

- **WHEN** effective replacement history contains encrypted, reasoning, signature, or unknown blocks
- **THEN** the reader MUST apply the existing private/unknown omission policy
- **AND** MUST NOT expose private state to the destination Provider

### Requirement: Native Continuation Package Budget MUST Be Transport Independent

The Context Package compiler MUST apply the configured estimated-token budget to the final portable
delta independently of whether delivery uses prompt transport or structured native history import.
Structured import capability MUST NOT be treated as unlimited context capacity.

#### Scenario: Codex structured import source exceeds budget

- **WHEN** `thread/inject_items` is supported and the effective portable history exceeds the package budget
- **THEN** the compiler MUST retain `native-history-import` as the transport mode
- **AND** MUST fold and trim the imported delta to the same configured budget
- **AND** `packageEstimatedTokens` MUST describe the budgeted delta

#### Scenario: source fits within budget

- **WHEN** effective portable history is within the configured package budget
- **THEN** the compiler MUST preserve the existing capability-selected transport
- **AND** MUST NOT introduce checkpoint omissions solely because another transport is available

### Requirement: Native Continuation Checkpoint MUST Preserve A Non-Empty Portable Spine

Checkpoint projection MUST deterministically bound oversized text and atomic Tool Exchange content.
If portable source entries exist, the compiler MUST preserve at least the latest User intent and the
latest Assistant result when available. It MUST NOT return an executable package whose estimated
Token count is zero, and it MUST fail closed if a non-empty in-budget package cannot be produced.

#### Scenario: a single Turn contains oversized Tool output

- **WHEN** the only or latest complete Turn exceeds budget because Tool Call/Result output is large
- **THEN** the compiler MUST keep each retained Tool Call/Result pair atomic
- **AND** MUST fold arguments and output using deterministic bounded evidence
- **AND** MUST preserve the User intent and latest Assistant result
- **AND** `packageEstimatedTokens` MUST be greater than zero and no greater than budget

#### Scenario: older complete Turns exceed budget

- **WHEN** multiple complete Turns exceed budget after deterministic folding
- **THEN** the compiler MUST remove oldest complete Turns first
- **AND** MUST retain a non-empty latest portable Turn
- **AND** MUST record each fold or removal in projection omissions

### Requirement: Provider Continuation Token Preview MUST Describe Projection Estimates

The Provider Continuation preview MUST describe source and package estimates as portable-history and
continuation-package estimates. It MUST NOT present deterministic character estimates as exact
Provider context usage or billing tokens.

#### Scenario: preview displays source and package estimates

- **WHEN** preparation returns `sourceEstimatedTokens` and `packageEstimatedTokens`
- **THEN** the dialog MUST label the values as portable history to continuation package
- **AND** MUST preserve the source-to-package direction
- **AND** MUST NOT claim the values are exact model tokenizer output
