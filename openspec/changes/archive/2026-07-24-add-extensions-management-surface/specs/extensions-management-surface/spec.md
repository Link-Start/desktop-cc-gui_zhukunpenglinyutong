## ADDED Requirements

### Requirement: Sidebar MUST Preserve Market While Opening Extensions Separately

The primary Sidebar MUST render both Market and Extensions entries. Market MUST remain visible and disabled until marketplace behavior is implemented. Extensions MUST remain interactive and switch the application to the Extensions mode.

#### Scenario: user inspects primary navigation

- **WHEN** the primary Sidebar renders
- **THEN** “市场”与“拓展” MUST both be visible
- **AND** Market MUST expose native disabled semantics
- **AND** activating Extensions MUST select `appMode = "extensions"`.

### Requirement: Extensions MUST Be A Workspace-Independent Surface

Extensions mode MUST render as a top-level management page beside the global Sidebar. It MUST NOT mount workspace header、conversation、composer or right-panel file/activity content.

#### Scenario: desktop user opens Extensions

- **WHEN** `appMode` is `extensions`
- **THEN** the global Sidebar and Extensions page MUST render
- **AND** workspace content、right panel、messages and composer MUST NOT render.

### Requirement: Extensions Controls MUST Follow The Approved Order

The page MUST provide section pills ordered `使用统计 / AI框架` before tabs ordered `Skills / Mcps / Plugins / Hooks / Rules / Commands / Subagents`. The page MUST NOT render a `Browse Marketplace` control until its navigation contract is implemented.

#### Scenario: Extensions page first opens

- **WHEN** the user opens Extensions
- **THEN** the CLI selector MUST default to Codex
- **AND** 使用统计 MUST be the active first section
- **AND** the framework section MUST be labeled `AI框架`
- **AND** all remaining tabs MUST follow the approved order
- **AND** the panel description MUST use the unified copy `即将实现`
- **AND** the panel MUST NOT render `添加` or `文档` action buttons
- **AND** Browse Marketplace MUST NOT render.
