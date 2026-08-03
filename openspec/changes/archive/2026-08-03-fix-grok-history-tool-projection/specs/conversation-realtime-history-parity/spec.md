## ADDED Requirements

### Requirement: Grok live versus history tool visibility MAY differ by protocol capability

For Grok sessions that use headless `streaming-json` (text/thought/end/error only), the live canvas MAY omit tool rows while tools are executing. After history hydrate from `chat_history.jsonl`, tool rows that exist on disk MUST become visible with real tool names. This live/history tool cardinality difference MUST NOT be treated as a parity defect.

#### Scenario: live turn without tool events is acceptable for Grok

- **WHEN** a Grok turn streams thought and/or text without tool events
- **AND** tools are only recorded in history files
- **THEN** the live canvas MUST NOT be required to invent tool rows
- **AND** history hydrate MUST surface those tools with non-generic names when the wire provides them

#### Scenario: history hydrate does not degrade all Grok tools to generic Tool

- **WHEN** history hydrate loads Grok tool_calls with real names such as `read_file` or `grep`
- **THEN** the visible tool timeline MUST preserve those names for classification and grouping
- **AND** MUST NOT render the stack as generic `Tool` cards solely due to a nested-`function` parse assumption
