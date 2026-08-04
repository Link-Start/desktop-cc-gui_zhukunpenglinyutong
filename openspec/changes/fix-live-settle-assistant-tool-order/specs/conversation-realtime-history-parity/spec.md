## ADDED Requirements

### Requirement: Live settlement MUST preserve assistant and tool interleave parity with history

Realtime streaming, completed settlement, and history hydrate MUST converge not only on row cardinality and duplicate prose rules, but also on the **relative order** of assistant text segments and tool items within the same user turn. Users MUST NOT need to reopen the thread for live order to match history order.

#### Scenario: post-tool conclusion order matches after settle and after history reopen

- **WHEN** a turn streams pre-tool assistant text (optional), one or more tool items, and post-tool assistant conclusion text
- **AND** turn terminal settlement has completed while the session remains open
- **THEN** the visible/durable order MUST place the post-tool conclusion after those tools
- **AND** when the user reopens the same thread through history hydrate, the relative assistant/tool interleave for that turn MUST remain equivalent
- **AND** history hydrate MUST NOT be required as the primary repair for an inverted live order

#### Scenario: history is not the only path that repairs inverted conclusion placement

- **WHEN** live settlement would otherwise leave conclusion prose on a pre-tool assistant item while tools sit after it
- **THEN** local realtime settlement MUST prevent or correct that inversion before relying on a later history refresh
- **AND** the product MUST NOT document “reopen conversation” as the intended fix for this class of ordering bug

#### Scenario: tool-separated assistant segments stay distinct across settle and history

- **WHEN** two non-equivalent assistant segments are separated by a tool item during realtime
- **THEN** completed settlement MUST keep them as distinct assistant facts in tool-separated order
- **AND** history hydrate for the same turn MUST NOT collapse them into a single pre-tool bubble solely due to shared base item ids
