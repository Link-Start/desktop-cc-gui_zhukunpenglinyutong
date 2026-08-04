## MODIFIED Requirements

### Requirement: Live assistant text MAY bypass root reducer while preserving final transcript convergence

During an active streaming turn, the message surface MUST support visible assistant body growth through a transient live-text channel instead of requiring every text delta to mutate the root conversation item array.

#### Scenario: live text grows when item identity remains stable

- **WHEN** an assistant message is streaming
- **AND** new body text arrives through the live assistant text channel
- **AND** the durable conversation item array identity does not change for that delta
- **THEN** the visible assistant row MUST still be able to show the new text
- **AND** the message surface MUST NOT depend solely on parent array identity or `scrollKey` changes as proof of live text growth

#### Scenario: completion converges to durable transcript state

- **WHEN** a streaming assistant message completes after using transient live text
- **THEN** the durable reducer/history settlement path MUST converge to the final assistant body
- **AND** the final transcript MUST NOT depend on the transient live channel remaining populated

#### Scenario: live text is scoped to the current assistant item

- **WHEN** multiple threads or assistant items are active or restored
- **THEN** live text channel subscriptions MUST be scoped by thread/item identity
- **AND** text published for one assistant item MUST NOT appear in another thread or item

#### Scenario: terminal convergence keeps post-tool text on the post-tool durable item

- **WHEN** live-text externalization is enabled
- **AND** tool-driven agent segmentation created a post-tool assistant durable identity during the turn
- **AND** conclusion text was visible on that post-tool run via the live-text channel during streaming
- **WHEN** agent completed and/or turn terminal settlement drains or finalizes that text
- **THEN** the durable item that stores the conclusion MUST be the post-tool identity
- **AND** the system MUST NOT converge the conclusion onto an earlier pre-tool assistant item of the same turn merely because the segment counter was reset or the live channel was cleared

#### Scenario: channel clear does not orphan or mis-attach the live tail

- **WHEN** settlement clears the live-text channel for a thread
- **THEN** any tail that was only present in the channel MUST already have been merged into the bound durable assistant item
- **AND** the visible transcript after clear MUST still show the full conclusion without reopening history
