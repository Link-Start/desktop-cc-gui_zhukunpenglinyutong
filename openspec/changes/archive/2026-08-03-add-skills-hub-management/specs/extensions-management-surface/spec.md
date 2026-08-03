# extensions-management-surface Delta

## MODIFIED Requirements

### Requirement: Extensions Controls MUST Follow The Approved Order

The page MUST provide section pills ordered `使用统计 / AI框架` before tabs ordered `Skills / Mcps / Plugins / Hooks / Rules / Commands / Subagents`. The page MUST NOT render a `Browse Marketplace` control until its navigation contract is implemented. The `Skills` tab MUST render the real skills dashboard section (see `skills-hub-management`) instead of the placeholder copy; remaining unimplemented tabs MUST keep the unified placeholder copy `即将实现`.

#### Scenario: Extensions page first opens

- **WHEN** the user opens Extensions
- **THEN** the CLI selector MUST default to Codex
- **AND** 使用统计 MUST be the active first section
- **AND** the framework section MUST be labeled `AI框架`
- **AND** all remaining tabs MUST follow the approved order
- **AND** unimplemented tabs MUST keep the unified copy `即将实现`
- **AND** the panel MUST NOT render `添加` or `文档` action buttons
- **AND** Browse Marketplace MUST NOT render.

#### Scenario: Skills tab renders the real dashboard

- **WHEN** the user activates the Skills tab
- **THEN** the skills dashboard section MUST render instead of the placeholder panel
- **AND** the vendored skills view MUST lazy-load with locale/theme bridging.
