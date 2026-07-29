## ADDED Requirements

### Requirement: Claude Shared Compaction MUST Preserve Exact Owner

Claude Shared prompt-overflow recovery and manual compaction MUST stay on the exact durable provider-scoped Binding. Prompt-overflow recovery MUST retain the existing one-shot `/compact → retry once` behavior and MUST NOT be converted to Codex-style proactive compaction.

#### Scenario: Shared Claude prompt overflows

- **WHEN** an accepted Shared Claude Attempt fails with `Prompt is too long`
- **THEN** the existing Claude runtime path MUST compact and retry the original request once in the same native session
- **AND** the Shared exact owner MUST remain associated until the final retried terminal

#### Scenario: Shared Claude manual compact uses managed provider

- **WHEN** a Shared Claude Binding uses a managed provider profile and manual compact is requested while no Attempt is active
- **THEN** `/compact` MUST execute through that exact provider-scoped Claude session
- **AND** it MUST NOT fall back to the local/default provider

#### Scenario: Shared Claude manual compact is requested during active attempt

- **WHEN** a Shared Claude Attempt is still unresolved
- **THEN** manual compact MUST fail with an actionable busy reason
- **AND** it MUST NOT race the active prompt or start a second recovery cycle
