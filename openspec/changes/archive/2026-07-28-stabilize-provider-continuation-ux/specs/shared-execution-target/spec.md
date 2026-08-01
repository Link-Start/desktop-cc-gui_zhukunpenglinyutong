## MODIFIED Requirements

### Requirement: Turn Attribution MUST Read TurnExecutionSnapshot

Every turn badge, usage record, error, retry, recovery action, and reload projection MUST be attributed to the immutable `TurnExecutionSnapshot`. The snapshot MUST freeze engine id plus readable CLI name, provider profile identity plus `providerProfileNameSnapshot`, model id plus readable model name, and reasoning at `conversation.turnRequested` creation. Current picker or binding state MUST NOT annotate historical Turns.

Only an explicit absent Provider Profile representing local/default semantics MAY display “本地配置”. A legacy Turn whose Provider identity cannot be proven MUST display an unknown-history label and MUST NOT fabricate local/default identity.

#### Scenario: deleted provider still renders explainable badge

- **WHEN** a provider profile referenced by a completed turn's snapshot has been deleted
- **THEN** the turn badge MUST display the snapshot's provider name
- **AND** the badge MUST mark the provider as unavailable without rewriting the snapshot

#### Scenario: two provider turns preserve distinct attribution after reload

- **WHEN** a Shared Session sends one Turn through Claude Provider A and the next through Codex Provider B, then reloads history
- **THEN** each Turn MUST display its frozen CLI, Provider, and Model identity
- **AND** neither Turn MUST be relabeled from the current picker or the other Turn's binding

#### Scenario: legacy provider identity is unknown

- **WHEN** a legacy Turn lacks both an explicit local/default semantic and a durable Provider Profile snapshot
- **THEN** the badge MUST display a human-readable unknown-history label
- **AND** MUST NOT display “本地配置” as a guess
