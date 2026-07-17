# claude-runtime-mcp-servers-panel Specification

## Purpose
TBD - created by archiving change add-claude-runtime-mcp-servers-panel. Update Purpose after archive.
## Requirements
### Requirement: The MCP Settings Panel MUST Surface Claude's Runtime MCP Servers

当用户在 MCP 设置面板选择 Claude 引擎时，系统 MUST 展示 Claude 在初始化时上报的运行时 MCP 服务器（只读），因为通过 `--mcp-config` 注入的服务器（含内置 `ccgui` 服务器）不会出现在用户配置列表中。

The panel sources this list from the per-workspace runtime snapshot the init
path already records (`getClaudeMcpRuntimeSnapshot(workspaceId)`); the card is
display-only and adds no server-mutation or backend surface.

#### Scenario: Claude engine selected renders the runtime servers card

- **WHEN** 用户在 MCP 设置面板选择 Claude 引擎
- **THEN** 系统 MUST 从当前工作区的运行时快照读取 Claude 上报的 MCP 服务器
- **AND** 每个服务器 MUST 以一行展示其名称与状态
- **AND** 若某服务器未上报状态，则 MUST 回退显示 `statusUnknown` 文案

#### Scenario: the built-in ccgui server is badged

- **GIVEN** 运行时快照包含内置服务器 `ccgui`
- **WHEN** 系统渲染运行时服务器列表
- **THEN** `ccgui` 行 MUST 显示 "built-in / 内置" 徽标
- **AND** 用户自有的其他服务器 MUST NOT 显示该徽标

#### Scenario: empty snapshot renders an empty state

- **WHEN** 当前工作区没有运行时快照，或快照未上报任何 MCP 服务器
- **THEN** 系统 MUST 显示 `noRuntimeServers` 空状态文案
- **AND** 系统 MUST NOT 渲染任何服务器行

#### Scenario: the card is display-only

- **WHEN** 用户查看运行时服务器卡片
- **THEN** 系统 MUST NOT 提供从该卡片新增、编辑或删除 MCP 服务器的操作
- **AND** 系统 MUST NOT 因渲染该卡片而引入新的 IPC/Rust 接口
