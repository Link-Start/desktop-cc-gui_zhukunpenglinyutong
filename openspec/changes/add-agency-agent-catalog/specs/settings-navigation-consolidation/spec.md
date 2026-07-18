## MODIFIED Requirements

### Requirement: Agent Prompt Management SHALL Host Agent And Prompt Tabs

系统 SHALL 将 `智能体` 与 `提示词库` 合并为一个左侧一级入口，并通过 tab 切换智能体管理与提示词库能力。`智能体` tab SHALL 进一步区分“我的智能体”与“内置智能体”，让 user-owned Agent CRUD 与 bundled Catalog 管理共享入口但保持数据边界。

#### Scenario: Agent prompt management shows agent and prompt tabs

- **WHEN** 用户打开设置页并进入合并后的智能体/提示词入口
- **THEN** 系统 MUST 显示 `智能体` 与 `提示词库` 两个 tab
- **AND** 用户 MUST 能通过点击 tab 在智能体管理与提示词库面板之间切换

#### Scenario: Agent tab preserves custom agent behavior

- **WHEN** 用户切换到 `智能体/提示词 -> 智能体 -> 我的智能体`
- **THEN** 系统 MUST 展示原 `智能体` section 内容
- **AND** 智能体读取、创建、编辑、删除、导入、导出或刷新行为 MUST 与迁移前保持等价

#### Scenario: Agent tab exposes built-in catalog separately

- **WHEN** 用户切换到 `智能体/提示词 -> 智能体 -> 内置智能体`
- **THEN** 系统 MUST 展示 bundled Agent Catalog 的搜索、分组、详情与 enable controls
- **AND** bundled Agent MUST 不作为 user-owned Agent 混入 `~/.ccgui/agent.json` 列表
- **AND** 用户 MUST 能清楚区分“我的智能体”与“内置智能体”

#### Scenario: Prompt tab preserves prompt behavior

- **WHEN** 用户切换到 `智能体/提示词 -> 提示词库`
- **THEN** 系统 MUST 展示原 `提示词库` section 内容
- **AND** 提示词读取、创建、编辑、删除、移动与 workspace 选择行为 MUST 与迁移前保持等价
