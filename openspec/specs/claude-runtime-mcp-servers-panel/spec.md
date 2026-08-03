# claude-runtime-mcp-servers-panel Specification

## Purpose
TBD - created by archiving change add-claude-runtime-mcp-servers-panel. Update Purpose after archive.
## Requirements
### Requirement: The MCP Settings Panel MUST Surface Claude's Runtime MCP Servers

当用户在 Extensions → Mcps 视图查看 Claude 引擎时，系统 MUST 展示 Claude 在初始化时上报的运行时 MCP 服务器（只读，归入 runtime-reported 分组），因为通过 `--mcp-config` 注入的服务器（含内置 `ccgui` 服务器）不会出现在用户配置列表中。MCP 管理面 MUST 位于 Extensions；Settings MUST NOT render an MCP management section.

The panel sources this list from the per-workspace runtime snapshot the init
path already records (`getClaudeMcpRuntimeSnapshot(workspaceId)`); the
runtime-reported group is display-only and adds no server-mutation or backend
surface.

#### Scenario: Claude engine selected renders the runtime servers group

- **WHEN** 用户在 Extensions → Mcps 查看 Claude 引擎
- **THEN** 系统 MUST 从当前工作区的运行时快照读取 Claude 上报的 MCP 服务器
- **AND** 每个服务器 MUST 以 runtime-reported 分组中的一行展示其名称与状态
- **AND** 若某服务器未上报状态，则 MUST 回退显示 `statusUnknown` 文案

#### Scenario: Settings no longer hosts MCP management

- **WHEN** the user opens Settings
- **THEN** no MCP management section MUST render
- **AND** MCP management MUST be reachable from Extensions → Mcps instead.

