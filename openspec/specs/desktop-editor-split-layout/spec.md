# desktop-editor-split-layout Specification

## Purpose
TBD - created by archiving change desktop-editor-split-left-composer. Update Purpose after archive.
## Requirements
### Requirement: Desktop Editor Split SHALL Keep Composer With Conversation Column

The system MUST render desktop editor split as a two-column work surface where the conversation column owns both messages and composer, and the file editor column owns the active file editor.

#### Scenario: workspace file open enters desktop split layout

- **WHEN** desktop layout opens a workspace file into the editor from the workspace file surfaces
- **THEN** the app MUST request the sidebar to collapse
- **AND** the editor split layout MUST become horizontal
- **AND** the editor file MUST NOT remain maximized
- **AND** the file MUST open in editor mode rather than diff mode

#### Scenario: horizontal editor split keeps composer in chat column

- **WHEN** desktop layout renders with `centerMode` set to `editor`
- **AND** editor split layout is horizontal
- **AND** the editor file is not maximized
- **THEN** the chat layer MUST contain both messages and composer
- **AND** the editor layer MUST remain a separate side-by-side file column

#### Scenario: editor column is not shortened by global composer

- **WHEN** desktop horizontal editor split is visible
- **THEN** composer MUST NOT be rendered as a global bottom row spanning under the editor column
- **AND** the file editor column MUST be able to use the available split height

#### Scenario: composer submit keeps active file visible

- **WHEN** desktop horizontal editor split is visible with an active file
- **AND** the user sends or queues a composer message
- **THEN** the app MUST preserve editor mode
- **AND** the active file editor MUST remain visible
- **AND** only explicit editor close, navigation, or mode-switch actions MAY return the center area to chat-only mode

#### Scenario: maximized editor owns the full center area

- **WHEN** desktop layout renders with `centerMode` set to `editor`
- **AND** the editor file is maximized
- **THEN** the hidden chat layer MUST NOT own an interactive composer
- **AND** the outer composer MUST NOT be rendered below the content area
- **AND** the editor layer MUST use the full available center content height

#### Scenario: non-editor desktop modes keep composer placement

- **WHEN** desktop layout renders normal chat, diff, memory, or home modes
- **THEN** composer placement MUST remain compatible with the existing mode-specific layout
- **AND** this editor split contract MUST NOT move composer for those modes

#### Scenario: compact layouts are outside desktop editor split contract

- **WHEN** phone or tablet layouts render messages and composer
- **THEN** their existing layout components MUST remain the source of composer placement
- **AND** desktop editor split changes MUST NOT alter compact navigation semantics

### Requirement: Desktop center layout SHALL host file compare as an independent work surface

系统 SHALL 在桌面中间区域支持独立文件对比 work surface，并保证其与现有 editor、diff、chat、composer placement 互不污染。

#### Scenario: file compare owns center content height
- **WHEN** desktop layout renders file compare mode
- **THEN** the compare surface SHALL occupy the center content area
- **AND** the global composer SHALL NOT overlay or shorten the compare editors

#### Scenario: file compare is separate from editor split
- **GIVEN** the user has an active editor file and open editor tabs
- **WHEN** the user opens file compare
- **THEN** the layout SHALL render compare mode instead of editor split mode
- **AND** editor split companion state SHALL remain available for later editor restoration

#### Scenario: exiting compare preserves editor maximized state
- **GIVEN** the editor file maximized state has a previous value
- **WHEN** the user opens and exits file compare
- **THEN** the system SHALL NOT toggle editor maximized state as a side effect

#### Scenario: non-desktop layouts keep existing navigation source
- **WHEN** phone or tablet layouts render
- **THEN** existing compact navigation components SHALL remain responsible for panel and composer placement
- **AND** desktop file compare layout rules SHALL NOT rewrite compact layout semantics

#### Scenario: center mode union accepts file compare across controller helpers
- **WHEN** helper hooks or layout types consume the center mode value
- **THEN** `fileCompare` SHALL be handled as an explicit independent mode
- **AND** helpers that only care about `editor` or `diff` SHALL NOT coerce file compare into those existing modes

