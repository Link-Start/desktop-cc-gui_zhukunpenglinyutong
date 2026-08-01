# composer-file-reference-completion-stability Specification

## Purpose
TBD - created by archiving change fix-composer-file-reference-at-white-screen. Update Purpose after archive.
## Requirements
### Requirement: Composer file-reference completion MUST normalize runtime sources

The composer file-reference completion provider MUST ignore malformed, blank, or non-string file and directory paths before creating completion items.

#### Scenario: malformed source paths are skipped
- **WHEN** the composer receives file-reference completion source entries that are blank, duplicated, or not strings
- **THEN** the completion provider MUST skip invalid entries
- **AND** it MUST return only valid unique file-reference completion items
- **AND** it MUST NOT throw during dropdown item generation

#### Scenario: malformed lazy directory children are skipped
- **WHEN** nested file-reference completion loads workspace directory children and the payload contains malformed entries
- **THEN** the completion provider MUST skip invalid child entries
- **AND** it MUST keep valid child entries available in the dropdown
- **AND** it MUST NOT crash the composer or app shell

### Requirement: Composer inline file-tag rendering MUST fail locally

The composer MUST isolate inline file-tag rendering failures so a `contenteditable` DOM rewrite or cursor-restoration exception does not blank the app shell.

#### Scenario: file tag render exception leaves composer recoverable
- **WHEN** the composer attempts to render an inline `@` file-reference tag and the DOM rewrite or cursor restoration fails
- **THEN** the failure MUST be logged through existing frontend diagnostics
- **AND** the composer MUST clear transient tag-render state that would keep retrying the same failed render
- **AND** the app shell MUST remain mounted and interactive

#### Scenario: raw file reference remains editable after render degradation
- **WHEN** inline file-tag rendering degrades after a failure
- **THEN** the raw file-reference text MUST remain editable in the composer
- **AND** subsequent normal typing MUST continue to update composer content

### Requirement: Composer slash command completion MUST normalize runtime sources

The composer slash command completion provider MUST ignore malformed project custom commands and SDK/bridge slash command payload entries before rendering dropdown items.

#### Scenario: malformed project custom commands are skipped
- **WHEN** project custom command entries contain missing, blank, or non-string `name` values
- **THEN** the slash command completion provider MUST skip those malformed entries
- **AND** valid commands MUST remain searchable and selectable
- **AND** the composer MUST NOT crash on macOS, Windows, or Linux

#### Scenario: malformed SDK slash commands are skipped
- **WHEN** the SDK/bridge slash command callback receives a mixed payload containing malformed entries
- **THEN** malformed entries MUST be skipped
- **AND** valid SDK slash commands and local slash commands MUST remain available
- **AND** duplicate command labels MUST be collapsed before dropdown rendering

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

### Requirement: Slash completion fallback MUST NOT wait for an absent runtime producer

When the Tauri build has no runtime slash-command refresh producer, the composer slash completion provider MUST return its local commands immediately and MUST NOT register or await legacy JCEF global callbacks.

#### Scenario: local slash completion resolves without bridge data
- **WHEN** the user opens slash completion and no runtime callback producer exists
- **THEN** the provider MUST return the local command set without a loading timeout
- **AND** it MUST NOT read or write `window.updateSlashCommands` or `window.__pendingSlashCommands`
