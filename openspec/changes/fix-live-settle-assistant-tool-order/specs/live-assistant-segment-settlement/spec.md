## ADDED Requirements

### Requirement: Live assistant writes MUST resolve a settlement-safe durable segment identity

When tool-driven agent segmentation creates multiple assistant durable ids for one provider `itemId` (`{base}`, `{base}-seg-1`, …), complete and append settlement MUST resolve the write target safely across `resetAgentSegment`. Preferring bare `{base}` whenever the segment counter is 0 is forbidden if post-tool `-seg-*` siblings already exist.

#### Scenario: late complete after segment reset targets latest -seg sibling

- **WHEN** a turn has durable assistants `{base}` (pre-tool) and `{base}-seg-1` (post-tool)
- **AND** `resetAgentSegment` has set the thread segment counter to 0
- **AND** `completeAgentMessage` arrives with provider itemId `{base}` and conclusion text
- **THEN** the system MUST update `{base}-seg-1` (or the latest `{base}-seg-*`)
- **AND** MUST NOT merge the conclusion into the pre-tool `{base}` item

#### Scenario: append of a missing -seg-N shell creates a new item

- **WHEN** agent segment has been incremented and no durable `{base}-seg-N` exists yet
- **AND** `appendAgentDelta` resolves to `{base}-seg-N`
- **THEN** the system MUST create a new assistant item with that segmented id
- **AND** MUST NOT append the delta onto the pre-tool bare `{base}` item

#### Scenario: tool boundary drain still precedes segment increment

- **WHEN** a tool item start causes `incrementAgentSegment`
- **AND** a live-text tail exists for the thread
- **THEN** the system MUST drain that tail into the pre-increment segment identity
- **AND** the drain dispatch MUST occur strictly before `incrementAgentSegment`

#### Scenario: post-tool text does not overwrite pre-tool body

- **WHEN** agent segment has already been incremented for at least one tool in the turn
- **AND** a new assistant text run starts after the tool boundary
- **THEN** post-tool text MUST land on a segmented durable id
- **AND** MUST NOT overwrite the pre-tool assistant item body with the post-tool conclusion

### Requirement: Turn terminal settlement MUST NOT remount conclusion text before tools

After a multi-tool turn where assistant text and tools interleaved correctly during streaming, turn completed / agent completed settlement MUST preserve the logical order: pre-tool assistant (if any), tools, post-tool assistant conclusion. The system MUST NOT require history reload to restore that order.

#### Scenario: streaming order survives turn completed

- **GIVEN** a turn whose live timeline already shows assistant segment A1, then one or more tool items, then assistant segment A2 with conclusion text (via live-text and/or durable shell)
- **WHEN** `turn/completed` (or equivalent terminal settlement) runs, including live-text drain, terminal marks, and `resetAgentSegment`
- **THEN** after settlement and with the session still open, A2 body MUST remain after the tool items in the durable item list
- **AND** A1 MUST NOT gain A2 conclusion text solely because segment counters reset

#### Scenario: late complete after resetAgentSegment does not hit seg0 early bubble

- **GIVEN** a turn that already created a segmented post-tool assistant durable item
- **AND** `resetAgentSegment` has set the thread segment counter to 0
- **WHEN** a late `completeAgentMessage` arrives with the base provider itemId and the conclusion body
- **THEN** the system MUST update the post-tool durable assistant item (or the last tool-separated assistant for that base id)
- **AND** MUST NOT merge the conclusion body into the first pre-tool assistant item of the same turn when that would place conclusion text before tools

#### Scenario: clear live channel only after durable convergence

- **WHEN** `completeAgentMessage` (or flush batch) finalizes an assistant body while live-text still holds a longer tail for the same text run
- **THEN** the system MUST drain or merge the remaining tail into the bound durable identity before clearing the channel
- **AND** MUST NOT clear the channel in a way that drops tail text or applies it to a different segment identity

### Requirement: Shared and Native sessions share the same segment settlement contract

Shared sessions (`threadKind=shared`) and Native engine sessions MUST apply the same durable-bind, drain, late-complete, and order invariants. Shared alias dual-target settlement MUST NOT write one thread's live-text tail onto another thread's earlier assistant item.

#### Scenario: Native Claude multi-tool turn keeps post-tool conclusion after settle

- **WHEN** a Native Claude thread completes a multi-tool turn with a post-tool conclusion
- **THEN** the durable order after settlement MUST keep the conclusion after tools without reopening history

#### Scenario: Shared Claude alias settle does not cross-write early assistant

- **WHEN** Shared turn settlement settles both a primary and an alias thread identity for the same turn
- **THEN** each target MUST drain and complete only against its own thread-scoped live-text binding and item list
- **AND** conclusion text MUST NOT appear before tools on the user-visible shared curtain solely due to alias reset ordering

### Requirement: Late tools MUST NOT remain after a final assistant conclusion

When tool items are observed only after assistant text for the same turn has already been written (including after `isFinal`), the durable item list MUST NOT leave those tools after the conclusion bubble. New tools MUST insert before a trailing final assistant run, and settlement/complete MUST rebalance trailing tools that were appended while the bubble was still non-final. Mid-stream tools after a **non-final** preamble MUST still append after that preamble so tool-then-conclusion segmentation remains possible.

#### Scenario: late tool after final assistant inserts before conclusion

- **GIVEN** the thread items end with a final assistant conclusion and no later tools
- **WHEN** a new tool item is upserted (e.g. late Grok history bridge ToolStarted)
- **THEN** the tool MUST be inserted before that final assistant item
- **AND** MUST NOT append after the conclusion

#### Scenario: mid-stream tool after non-final preamble still appends after preamble

- **GIVEN** the latest assistant message is non-final (streaming preamble)
- **WHEN** a tool item starts
- **THEN** the tool MAY append after that preamble
- **AND** MUST NOT be forced before the non-final preamble solely by the late-tool rule

#### Scenario: rebalance after complete moves trailing tools before final assistants

- **GIVEN** tools were appended after an assistant bubble while it was still non-final
- **AND** that assistant is later marked final via complete or markLatestFinal
- **WHEN** settlement finalizes the assistant
- **THEN** trailing tools that sit after the final assistant run MUST be moved before that final assistant block

### Requirement: Segment settlement diagnostics MUST stay bounded and privacy-safe

When the implementation detects a mismatch between “current segment resolution” and “bound durable identity” during complete or drain, it MAY emit bounded diagnostics. Diagnostics MUST NOT include user prompt text or full assistant body text.

#### Scenario: mismatch records structural fields only

- **WHEN** a late complete or drain chooses a durable id that differs from naively resolving the base itemId at segment 0
- **THEN** any diagnostic payload MUST be limited to structural fields such as thread id, base item id, segment counter, chosen durable id, and reason code
- **AND** MUST NOT include full message prose
