## ADDED Requirements

### Requirement: Empty Live Assistant Shell MUST Not Create Fake User-User Stack

`prepareThreadItems` MUST NOT unconditionally drop an assistant message that has empty `text`, no images, and no `executionTargetSnapshot`. The system MUST keep that assistant shell when it still has structural meaning, so the curtain MUST NOT collapse two real user turns into adjacent blue bubbles solely because live-text externalization left an empty reducer shell.

The system MUST drop the shell only when all of the following hold: the assistant is empty as defined above, the turn is settled, no later user message exists in the same list, and the assistant id is not referenced by `liveAssistantTextChannel`.

Two genuine user messages with no assistant between them MUST remain two visible user bubbles.

#### Scenario: live-externalized empty assistant between two users is kept

- **WHEN** the item list is `user A → assistant shell (empty text, no images, no executionTargetSnapshot) → user B`
- **AND** the assistant belongs to a processing turn, or its id is referenced by `liveAssistantTextChannel`, or user B appears after it
- **THEN** `prepareThreadItems` MUST keep the assistant shell
- **AND** the visible transcript MUST NOT render as adjacent user A and user B with nothing in between

#### Scenario: settled empty assistant with no later user may be dropped

- **WHEN** an assistant has empty text, no images, and no `executionTargetSnapshot`
- **AND** its turn is settled
- **AND** no later user message exists in the same list
- **AND** its id is not referenced by `liveAssistantTextChannel`
- **THEN** `prepareThreadItems` MAY drop that assistant
- **AND** the system MUST NOT keep a blank historical card solely because the text is empty

#### Scenario: two real user turns without an assistant stay distinct

- **WHEN** the item list contains two user messages with no assistant item between them
- **THEN** both user bubbles MUST remain visible
- **AND** empty-assistant keep policy MUST NOT invent an assistant row to separate them

### Requirement: Unmatched Incoming History MUST Insert Relative To Matched Neighbors

When `mergeThreadItemsPreservingOptimisticUsers` preserves local-only items (optimistic user or compaction) and then places unmatched incoming items, the system MUST insert each leftover incoming item relative to its nearest already-emitted incoming neighbor. The system MUST NOT use "append every leftover to the end" as the only placement strategy.

Relative insert MUST prefer: after an already-emitted incoming predecessor; else before an already-emitted incoming successor; else at the start when the leftover segment precedes the first matched incoming item. Append is allowed only when no neighbor exists.

The system MUST NOT reorder the list by `timestamp`.

#### Scenario: late disk tail does not jump below the newest local tail

- **WHEN** local items already contain a newer tail including an unmatched optimistic user
- **AND** a late `setThreadItems` arrives with a Claude disk tail window or Shared projection whose unmatched items are earlier than that tail
- **THEN** the merged timeline MUST keep earlier unmatched incoming items above the newer local tail
- **AND** the optimistic user MUST remain at the newest end
- **AND** the system MUST NOT append the earlier window after the optimistic user

#### Scenario: leftover between two matched ids stays between them

- **WHEN** incoming contains `matched-1 → unmatched-X → matched-2`
- **AND** local order emits `matched-1` and `matched-2` while preserving a local-only item
- **THEN** unmatched-X MUST be inserted between `matched-1` and `matched-2`
- **AND** MUST NOT be pushed after the local-only tail

#### Scenario: leftover with no matched neighbor may append

- **WHEN** leftover incoming items have no already-emitted incoming predecessor or successor
- **AND** they do not precede a matched incoming item
- **THEN** the merge MAY append those leftovers
- **AND** this MUST be the fallback, not the default path for a late older window

### Requirement: First-Paint History Window MUST Reuse Turn-Boundary Cut

When `dispatchThreadItemsProgressively` first-paints a list larger than `THREAD_ITEMS_FIRST_PAINT_COUNT` (300) in `tail-first` mode, the cut index MUST be computed by the same `resolveHistoryWindowCutIndex` function used by the DOM history window. The first-paint path MUST NOT use a bare `items.slice(-N)` that splits a `turnId` segment.

`atomic` mode and lists that already fit in the first-paint budget MUST keep writing the full list in one `setThreadItems`.

#### Scenario: first-paint cut retreats to the turn start

- **WHEN** a thread hydrates more than 300 items in `tail-first` mode
- **AND** index `length - 300` falls inside a contiguous `turnId` segment
- **THEN** the displayed slice MUST start at that turn's first item
- **AND** `remainingOlderCount` MUST equal the shared cut index
- **AND** the implementation MUST call `resolveHistoryWindowCutIndex` rather than a copied while-loop

#### Scenario: short lists and atomic mode skip the first-paint cut

- **WHEN** the list length is at most the first-paint budget
- **OR** the dispatch mode is `atomic`
- **THEN** the system MUST dispatch the full list in one `setThreadItems`
- **AND** MUST NOT apply a turn-boundary cut
