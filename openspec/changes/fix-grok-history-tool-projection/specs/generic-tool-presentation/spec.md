## ADDED Requirements

### Requirement: Classifiable tools MUST prefer specialized group or block presentation over unknown generic Tool

When a tool item's title/name classifies as read, edit, bash, or search under shared tool semantics, the conversation canvas MUST route it through the specialized group/block path. History projection that strips real names and forces large stacks of unknown generic `Tool` cards is NOT acceptable for known tool names such as `read_file`.

#### Scenario: known file read name is not generic-only

- **WHEN** a tool item title/name is `read_file` (or an equivalent read-classified name)
- **THEN** presentation MUST be eligible for Read tool block or read group rendering
- **AND** MUST NOT be forced into unknown generic `Tool` labeling solely because the item came from Grok history

#### Scenario: unknown true names still fall back generically

- **WHEN** a tool name is genuinely unknown and not classifiable
- **THEN** generic tool presentation remains allowed
