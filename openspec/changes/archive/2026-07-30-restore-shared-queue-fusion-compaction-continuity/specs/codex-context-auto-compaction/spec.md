## MODIFIED Requirements

### Requirement: Codex Auto Compaction Trigger

The system MUST automatically trigger context compaction for Codex threads when context usage reaches the configured high-watermark. A high-watermark observed while a user Turn is processing MUST be latched and evaluated at the next safe settlement barrier. User prompt dispatch and compaction MUST reserve the same native-thread control gate.

#### Scenario: Skip auto compaction when disabled

- **WHEN** Codex auto compaction is disabled in app settings
- **AND** a Codex thread reports token usage percent greater than or equal to the configured compaction threshold
- **THEN** the runtime SHALL NOT start or latch automatic context compaction for that thread

#### Scenario: Trigger compaction when threshold exceeded

- **WHEN** a Codex thread reports token usage percent greater than or equal to the configured compaction threshold
- **AND** Codex auto compaction is enabled
- **AND** the thread has no active or pending user dispatch
- **THEN** the runtime SHALL reserve the compaction gate and start auto compaction for that thread

#### Scenario: latch threshold while processing

- **WHEN** a Codex thread reaches the configured threshold while a user Turn is processing
- **THEN** runtime MUST retain the high-watermark instead of discarding it
- **AND** runtime MUST evaluate it when the user Turn settles even if the terminal event contains no usage payload

#### Scenario: compaction wins before a new Shared prompt

- **WHEN** auto compaction has already reserved the native-thread gate
- **AND** a Shared user prompt is submitted for the same Binding
- **THEN** the prompt MUST wait without being sent
- **AND** it MUST be sent for the first time after `thread/compacted` or `thread/compactionFailed` releases the gate

#### Scenario: user prompt wins before compaction

- **WHEN** a user prompt reserves the native-thread gate before auto compaction
- **THEN** auto compaction MUST remain pending until that Turn settles
- **AND** it MUST NOT replace the accepted user Turn

#### Scenario: Do not trigger below threshold

- **WHEN** a Codex thread reports token usage percent lower than the configured compaction threshold
- **THEN** the runtime SHALL NOT start auto compaction

## ADDED Requirements

### Requirement: Codex Compaction Barrier MUST Recover From Missing Lifecycle Completion

The native-thread compaction barrier MUST remain bounded. Missing completion events MUST not permanently block conversation flow.

#### Scenario: compaction lifecycle times out

- **WHEN** an in-flight compaction exceeds the existing bounded timeout without completion or failure evidence
- **THEN** the stale in-flight reservation MUST be released
- **AND** the next user dispatch MUST remain possible with diagnostics recording the timeout
