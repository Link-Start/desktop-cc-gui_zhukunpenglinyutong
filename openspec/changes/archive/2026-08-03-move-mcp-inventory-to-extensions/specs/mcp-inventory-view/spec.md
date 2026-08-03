# mcp-inventory-view Delta

## ADDED Requirements

### Requirement: Extensions MUST Provide An MCP Inventory Tab

Extensions MUST provide a dedicated Mcps tab that shows MCP server inventories for Claude Code and Codex. The view MUST separate config-defined servers from runtime-reported servers, MUST support filtering by source and text search, and MUST open a detail panel per server showing metadata, tools, auth/status, transport, command, and URL details.

#### Scenario: user inspects MCP servers

- **WHEN** the user opens Extensions → Mcps
- **THEN** the view MUST list Claude Code and Codex MCP inventories
- **AND** config-defined servers MUST be visually separated from runtime-reported servers
- **AND** source filtering and search MUST narrow the visible rows.

#### Scenario: user opens a server detail

- **WHEN** the user selects a server row
- **THEN** a detail panel MUST show that server's metadata, tools, auth/status, transport, command, and URL details.

### Requirement: MCP Config Aggregation MUST Cover All Config Sources

The backend MUST aggregate MCP configuration from both `~/.claude.json` and the ccgui config; it MUST NOT return after the first matching source. Enabling or disabling a global MCP server from the UI MUST go through a dedicated Tauri command, and writes MUST preserve the existing field shapes: object-form `disabledMcpServers` and array-form `enabled` fields.

#### Scenario: both config sources aggregated

- **WHEN** servers are defined in both `~/.claude.json` and the ccgui config
- **THEN** the inventory MUST include entries from both sources
- **AND** MUST NOT stop at the first source that produced results.

#### Scenario: toggle preserves config shapes

- **WHEN** the user toggles a global MCP server off and on
- **THEN** the backend MUST write the toggle back through the Tauri command
- **AND** object-form `disabledMcpServers` and array-form `enabled` fields MUST keep their original shapes
- **AND** toggle failures MUST surface a visible error in the UI.
