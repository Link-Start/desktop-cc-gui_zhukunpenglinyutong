# claude-manual-compact-command Specification Delta

## ADDED Requirements

### Requirement: Manual Compact Duration Is Not Wall-Clock Capped

Claude manual `/compact` MUST NOT be aborted by an arbitrary total-duration
wall-clock cap. Because compaction is an LLM summarization over the whole
conversation and legitimately takes minutes on a large context, hang protection
MUST come from the runtime's first-event watchdog rather than a fixed elapsed
limit, matching the uncapped auto-compaction path.

#### Scenario: legitimate long compaction runs to completion

- **WHEN** the user submits `/compact` on a large Claude context
- **AND** the runtime is actively producing the compaction summary beyond the
  former fixed cap
- **THEN** the product MUST let the compaction continue to completion
- **AND** the product MUST surface the existing compacting / compacted lifecycle
  feedback rather than a timeout failure

#### Scenario: a true runtime hang is still surfaced

- **WHEN** the user submits `/compact`
- **AND** the runtime never emits a first response event
- **THEN** the product MUST surface a failure via the existing first-event
  watchdog
- **AND** the conversation MUST NOT be left in a stuck processing state

#### Scenario: no arbitrary elapsed cap is imposed on the send

- **WHEN** manual `/compact` dispatches the command to the Claude session
- **THEN** the product MUST NOT wrap the send in a fixed total-duration timeout
- **AND** manual compact duration handling MUST match the uncapped
  auto-compaction path
