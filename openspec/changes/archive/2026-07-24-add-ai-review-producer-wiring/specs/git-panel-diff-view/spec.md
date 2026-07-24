# git-panel-diff-view delta — add-ai-review-producer-wiring

## ADDED Requirements

### Requirement: Semantic Diff AI Review Is Generated On Demand Per Turn

The session activity semantic diff SHALL generate its AI review explain layer on demand when the user opens a turn's semantic diff tab, SHALL cache the result per turn, and SHALL degrade silently to deterministic rule facts when generation or parsing fails.

#### Scenario: AI review is generated when the semantic tab is opened

- **WHEN** the user opens a turn's semantic diff tab and that turn has no cached AI review
- **THEN** the client SHALL request an AI review for that turn through a lightweight hidden engine session (sessionPurpose `semantic-diff-review`)
- **AND** the request SHALL summarize the turn's changed files with bounded diff truncation
- **AND** deterministic rule facts SHALL render immediately without waiting for the AI review.

#### Scenario: AI review output is validated against the evidence contract

- **WHEN** the engine returns review output for a turn
- **THEN** the client SHALL parse it as structured JSON and validate each fact's category, confidence, text, and evidence refs
- **AND** facts whose evidence paths do not belong to the turn's changed files SHALL be dropped
- **AND** facts without any valid evidence ref SHALL be dropped
- **AND** accepted facts SHALL merge into the intent, behavior, risk, and validation zones as AI-sourced review hints that augment rather than replace deterministic facts.

#### Scenario: Generation or parse failure degrades silently

- **WHEN** the engine request fails, times out, or returns output that cannot be parsed into the review contract
- **THEN** the semantic diff SHALL render without AI facts
- **AND** the UI SHALL NOT surface an error or block interaction
- **AND** the failure SHALL be cached for that turn so the same turn is not requested repeatedly.

#### Scenario: Repeated views reuse the cached review

- **WHEN** the user revisits the semantic diff tab of a turn that already has a completed AI review attempt
- **THEN** the client SHALL reuse the cached review (including a cached empty or failed result)
- **AND** it SHALL NOT issue another engine request for that turn.
