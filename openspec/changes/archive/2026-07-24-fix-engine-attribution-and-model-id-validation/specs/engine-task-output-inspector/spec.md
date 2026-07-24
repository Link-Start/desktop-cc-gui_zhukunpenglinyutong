# Delta: engine-task-output-inspector

## MODIFIED Requirements

### Requirement: Inspector Snapshot MUST Use Engine-Aware Task Identity
The inspector MUST normalize delegated work from every supported engine (`claude` / `codex` / `gemini` / `kimi` / `opencode`) into a shared view model while preserving engine-specific identity fields, and the snapshot `engine` attribution MUST reflect the real engine rather than a codex-or-claude binary assumption.

#### Scenario: Claude snapshot preserves task and tool identity
- **WHEN** the source task is a Claude task
- **THEN** the snapshot MUST preserve `taskId` when available
- **AND** the snapshot MUST preserve `toolUseId` when available
- **AND** missing identity fields MUST be represented as `null` rather than guessed
- **AND** when a known output artifact path exists, the snapshot MUST preserve it separately from the display file name

#### Scenario: Codex snapshot preserves thread identity
- **WHEN** the source task is a Codex delegated agent with a thread target
- **THEN** the snapshot MUST preserve `threadId`
- **AND** the snapshot MUST NOT invent a Claude-style `taskId`

#### Scenario: non-codex engines keep their real engine attribution
- **WHEN** the source task originates from `gemini`, `kimi`, or `opencode`
- **THEN** the snapshot `engine` field MUST equal that real engine value
- **AND** it MUST NOT be relabeled as `claude` by a binary codex-or-claude fallback

#### Scenario: unknown engine values fall back explicitly
- **WHEN** a task output source carries an engine value outside the supported engine set
- **THEN** the projection MUST normalize it to the explicit `"claude"` fallback
- **AND** the fallback MUST be a single bounded normalization point rather than scattered ternaries

#### Scenario: unavailable output remains explicit
- **WHEN** the system has task identity but no output text or output file fact
- **THEN** the inspector MUST render the output state as unavailable or pending
- **AND** it MUST NOT render an empty successful output block as if the task produced no output
