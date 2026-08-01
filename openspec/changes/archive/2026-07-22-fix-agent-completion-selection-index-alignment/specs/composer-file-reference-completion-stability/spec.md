## MODIFIED Requirements

### Requirement: Shared completion dropdown mapping MUST fail per item

The shared composer completion dropdown MUST isolate failures while mapping provider results into dropdown items and MUST preserve identity alignment between every visible selectable item and its raw provider item.

#### Scenario: malformed dropdown item does not drop valid items
- **WHEN** a completion provider returns multiple results and mapping one result to a dropdown item fails
- **THEN** that result MUST be skipped and logged
- **AND** valid mapped results MUST remain visible
- **AND** selecting a visible item MUST pass the matching raw provider item to the completion selection handler

#### Scenario: non-array provider result is treated as empty
- **WHEN** a completion provider unexpectedly resolves to a non-array value
- **THEN** the dropdown MUST log the invalid provider result
- **AND** it MUST show an empty completion list rather than crashing the composer

#### Scenario: presentation-only items do not shift mouse selection
- **WHEN** a completion result list contains section headers or separators before selectable items
- **AND** the user clicks a visible selectable item
- **THEN** the completion selection handler MUST receive the raw provider item represented by the clicked row
- **AND** presentation-only items MUST NOT consume a selectable index

#### Scenario: presentation-only items do not shift keyboard selection
- **WHEN** a completion result list contains section headers or separators before selectable items
- **AND** the user confirms the active item with Enter or Tab
- **THEN** the completion selection handler MUST receive the raw provider item represented by the active selectable row
- **AND** the handler MUST NOT receive a section header or separator
