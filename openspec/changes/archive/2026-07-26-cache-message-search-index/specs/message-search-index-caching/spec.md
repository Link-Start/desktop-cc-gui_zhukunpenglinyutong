## ADDED Requirements

### Requirement: Message search SHALL reuse immutable snapshot indexes

Message search SHALL build an in-memory index once for the same canonical `threadItemsByThread` snapshot and ordered thread-id set, and SHALL reuse that index across query changes.

#### Scenario: Repeated query uses the same snapshot

- **WHEN** multiple message searches use the same `threadItemsByThread` object and ordered thread ids
- **THEN** the system SHALL reuse the same indexed message collection
- **AND** SHALL NOT traverse and re-box every conversation item again

#### Scenario: Canonical message snapshot changes

- **WHEN** message content is added, edited, or removed and the canonical `threadItemsByThread` snapshot reference changes
- **THEN** the system SHALL build an index from the new snapshot
- **AND** SHALL NOT return results from the old snapshot cache

### Requirement: Message index SHALL preserve search behavior

The cached message index SHALL preserve original message text for titles/snippets and SHALL store normalized lowercase text for case-insensitive matching.

#### Scenario: Query casing changes

- **WHEN** the same query is entered with different letter casing
- **THEN** message result identity, score, and matching behavior SHALL remain case-insensitive
- **AND** query evaluation SHALL reuse normalized indexed text

#### Scenario: Empty and non-message items are excluded

- **WHEN** a thread contains empty messages or non-message conversation items
- **THEN** the index SHALL exclude those items exactly as before
- **AND** valid message ordering SHALL remain unchanged
