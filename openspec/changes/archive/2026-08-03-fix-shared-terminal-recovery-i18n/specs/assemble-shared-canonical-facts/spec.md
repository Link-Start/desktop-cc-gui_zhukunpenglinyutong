## ADDED Requirements

### Requirement: Failed Runtime Terminal MUST Be Classified Before Canonical Assembly

The Shared Runtime lifecycle owner MUST normalize every authoritative terminal whose outcome is
`failed` to a non-empty stable `errorCode` before constructing `RuntimeFinalSnapshot`. A real
non-empty Provider or Runtime code MUST be preserved. The canonical validator MUST remain
fail-closed and MUST NOT be relaxed to accept an unclassified failed outcome.

#### Scenario: failed Codex terminal without code receives fallback classification

- **WHEN** Codex emits `turn/completed` with `status=failed` and no non-empty failure code
- **THEN** the Shared Runtime coordinator MUST set `errorCode=runtime_failure_unclassified`
- **AND** the resulting `conversation.turnCommitted` MUST pass canonical validation

#### Scenario: failed EngineEvent terminal without code receives fallback classification

- **WHEN** an Engine adapter emits `TurnCompleted` with a failed outcome and no non-empty failure code
- **THEN** the same fallback classification MUST be applied before canonical assembly
- **AND** the Attempt MUST NOT enter `canonical-terminal-commit-failed` solely because the Runtime omitted a code

#### Scenario: real provider code is preserved

- **WHEN** failed terminal evidence includes a non-empty Provider or Runtime failure code
- **THEN** the committed outcome MUST preserve that code verbatim
- **AND** it MUST NOT replace it with the fallback classification

#### Scenario: cancel intent wins before failure fallback

- **WHEN** a failed terminal settles an Attempt with a registered cancel intent
- **THEN** the terminal MUST be classified as `cancelled`
- **AND** the failed-only fallback code MUST NOT change the cancellation outcome
