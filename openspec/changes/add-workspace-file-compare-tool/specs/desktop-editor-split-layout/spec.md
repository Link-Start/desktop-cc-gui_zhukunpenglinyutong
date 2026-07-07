## ADDED Requirements

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
