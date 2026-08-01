## ADDED Requirements

### Requirement: Client SHALL Ship A Versioned Agency Agents Catalog

客户端 SHALL 将 `agency-agents` 的固定 source revision 作为 bundled Agent Catalog 随 release 发布，而不是在运行时从网络下载或执行上游安装脚本。Catalog MUST 包含 17 个 division、248 个唯一 Agent、MIT attribution、stable ID、source path、source revision 与 Prompt SHA-256。

#### Scenario: Bundled catalog is complete

- **WHEN** 客户端构建或执行 Catalog integrity check
- **THEN** Catalog MUST 包含 17 个 division 与 248 个唯一 Agent
- **AND** 每个 Agent MUST 归属且只归属一个已声明 division
- **AND** 未分组 Agent、重复 stable ID、空 Prompt 或不安全 relative path MUST 导致校验失败

#### Scenario: Runtime works without upstream checkout or network

- **WHEN** 已发布客户端运行且本地不存在 `agency-agents` Git checkout
- **THEN** Settings 与 Composer MUST 仍能读取 bundled Catalog
- **AND** 客户端 MUST NOT 访问 GitHub 或执行 `install.sh`、`convert.sh`

#### Scenario: Prompt integrity mismatch fails closed

- **WHEN** bundled Prompt body 的实际 SHA-256 与 Catalog metadata 不一致
- **THEN** backend MUST 拒绝解析或返回该 Prompt
- **AND** send path MUST NOT 注入该 Prompt

### Requirement: Catalog Metadata SHALL Be Localized And Grouped

Catalog SHALL 为 division 与 Agent metadata 提供稳定本地化展示。MVP MUST 提供 `en` 和 `zh-CN` 的 Agent name/description，中文模式 MUST 展示中文名称、中文描述和中文 division；其他 locale 缺少 Catalog 翻译时 MUST fallback 到 English。

#### Scenario: Simplified Chinese metadata is complete

- **WHEN** locale 为 `zh`
- **THEN** 248 个 Agent MUST 全部展示非空中文名称与中文描述
- **AND** 17 个 division MUST 全部展示中文 label
- **AND** UI MUST NOT 用原始 Prompt body 作为列表摘要

#### Scenario: Traditional Chinese uses explicit MVP fallback

- **WHEN** locale 为 `zh-TW`
- **THEN** Settings 与 Composer UI copy MUST 使用现有繁体中文 locale
- **AND** Catalog name/description MUST fallback 到 `zh-CN`

#### Scenario: Other locales fall back to English catalog metadata

- **WHEN** active locale 既不是 `zh` 也不是 `zh-TW`
- **AND** Catalog 不包含该 locale 的 metadata
- **THEN** Agent 与 division MUST 使用 English name/description/label

#### Scenario: Search accepts localized and English terms

- **WHEN** 用户在内置智能体列表或 `#` picker 中搜索
- **THEN** 系统 MUST 匹配 active locale name/description、English name/description 与 division label

### Requirement: Settings SHALL Own Built-In Agent Enable State

系统 SHALL 使用独立的 `AppSettings.enabledBuiltInAgentIds` 保存跨 workspace 的 bundled Agent enable 状态。默认集合 MUST 为空；Enabled 只代表允许出现在 Composer `#` picker，不得自动注入 Prompt。

#### Scenario: Built-in agents default off

- **WHEN** 旧 settings 不包含 `enabledBuiltInAgentIds` 或用户从未开启内置智能体
- **THEN** Settings MUST 仍列出全部 248 个内置智能体
- **AND** 所有内置智能体 toggle MUST 为 off
- **AND** Composer `#` MUST 不显示任何内置智能体

#### Scenario: Individual toggle persists

- **WHEN** 用户在 Settings 开启一个已知 bundled Agent
- **THEN** backend MUST 将其 stable ID 持久化到 `enabledBuiltInAgentIds`
- **AND** 返回的 AppSettings MUST 成为 frontend 的新本地状态
- **AND** 该 Agent MUST 无需重启进入 `#` picker

#### Scenario: Unknown agent cannot be enabled

- **WHEN** enable command 收到空 ID、非法 ID 或 Catalog 中不存在的 ID
- **THEN** command MUST 返回错误
- **AND** MUST NOT 持久化该 ID

#### Scenario: Division bulk toggle is deterministic

- **WHEN** 用户对一个 division 执行全部开启或全部关闭
- **THEN** backend MUST 仅修改该 division 的已知 Agent IDs
- **AND** enabled IDs MUST 去重并使用 deterministic order
- **AND** 其他 division 与 user-owned Agent MUST 不受影响

### Requirement: Settings SHALL Present Clear Built-In Agent Groups

`智能体/提示词 -> 智能体 -> 内置智能体` SHALL 展示 `全部` 与 17 个 division，并显示每个 division 的 `enabled / total` 数量。每个 Agent row/card MUST 展示 localized name、localized description、division badge、enable switch 与详情入口。

#### Scenario: User browses a division

- **WHEN** 用户选择一个 division
- **THEN** 列表 MUST 只显示属于该 division 的内置智能体
- **AND** header/navigation MUST 显示该 division 的 enabled count 与 total count

#### Scenario: User filters enabled agents

- **WHEN** 用户选择“仅看已开启”
- **THEN** 列表 MUST 只显示 ID 存在于 `enabledBuiltInAgentIds` 的内置智能体
- **AND** division counts MUST 继续反映完整 `enabled / total` 状态

#### Scenario: Metadata view does not load prompt bodies

- **WHEN** 用户打开内置智能体列表、切换 division 或搜索
- **THEN** backend response MUST NOT 包含 248 个 Prompt body
- **AND** Prompt body MUST 只在用户查看详情或真正选择/发送时按单项读取

#### Scenario: Settings exposes upstream attribution

- **WHEN** 用户浏览内置智能体 Catalog
- **THEN** Settings MUST 展示 Catalog display name、license 与 source revision
- **AND** source attribution MUST 作为可访问的链接指向 Catalog `sourceUrl`
- **AND** 激活链接 MUST 在客户端既有 external navigation boundary 中打开，不得替换当前 Settings 页面

### Requirement: Composer Hash Picker SHALL Only Discover Enabled Built-In Agents

Composer 现有 `#` trigger SHALL 合并 user-owned Agent 与 enabled bundled Agent。未 enabled 的 bundled Agent MUST 在 provider 数据源层被过滤，不得仅通过 CSS 隐藏。

#### Scenario: Hash picker groups enabled agents

- **WHEN** 用户在行首输入 `#`
- **THEN** picker MUST 区分“我的智能体”与 bundled division
- **AND** bundled result MUST 只包含 enabled Agent
- **AND** 每个 bundled result MUST 展示 localized description 与 division badge
- **AND** 每个 group header MUST 展示 localized label 与当前可见数量
- **AND** group header MUST NOT 进入 keyboard selectable index

#### Scenario: Search cannot reveal disabled agent

- **WHEN** 用户输入一个 disabled bundled Agent 的完整中文或英文名称
- **THEN** `#` 搜索结果 MUST 不包含该 Agent

#### Scenario: Toggle refreshes picker without restart

- **WHEN** 用户在 Settings 开启或关闭一个 bundled Agent
- **THEN** Agent provider cache MUST 被刷新
- **AND** 下一次打开或搜索 `#` 时 MUST 反映新状态
- **AND** 系统 MUST NOT 依赖秒级 polling

#### Scenario: Stale catalog request cannot overwrite the latest state

- **WHEN** locale 切换、Settings toggle 或 cache invalidation 触发多个重叠 Catalog 请求
- **AND** 较旧请求晚于较新请求返回
- **THEN** frontend MUST 忽略较旧 settlement
- **AND** disabled Agent MUST NOT 被旧 cache 重新带回 `#`

### Requirement: Built-In Agent Prompt SHALL Require Explicit Active Selection

系统 SHALL 将 Available、Enabled 与 Active 视为不同状态。只有用户通过 `#` 选中 bundled Agent、Composer 显示该 Agent Chip 且 send-time backend validation 通过时，系统才可把该 Agent Prompt 注入现有 `## Agent Role and Instructions` block。

#### Scenario: Enabled but not selected does not inject

- **WHEN** bundled Agent 已 enabled
- **AND** 当前 Composer 没有该 Agent Chip
- **THEN**发送消息 MUST NOT 读取或注入该 Agent Prompt

#### Scenario: Explicit hash selection injects

- **WHEN** 用户通过 `#` 选择一个 enabled bundled Agent
- **AND** Composer 显示该 Agent Chip
- **AND** send-time backend validation 返回匹配 hash 的 Prompt body
- **THEN** supported engine 的下一条消息 MUST 注入该 Agent name/icon/body
- **AND**消息可见 metadata MUST 保留 selected Agent name/icon

#### Scenario: Disabled active agent fails closed

- **WHEN** thread 中保存了 bundled Agent selection
- **AND** 用户随后在 Settings 关闭该 Agent
- **THEN**下一次发送 MUST 重新验证 enable 状态
- **AND** MUST NOT 使用 client store 中的旧 Prompt
- **AND** UI MUST 清除或标记该 Agent Chip 为不可用并提供可理解提示

#### Scenario: Resolution failure does not fall back to stale body

- **WHEN** bundled Agent ID 不存在、Prompt 文件缺失、hash 不匹配或 backend resolve 失败
- **THEN** send path MUST NOT 注入该 Agent Prompt
- **AND** MUST NOT 静默回退到 persisted selection 中的 Prompt snapshot

### Requirement: Built-In Agent Prompt Loading SHALL Preserve Permission Boundaries

Catalog metadata 中的 `tools`、角色描述或 Prompt text SHALL 仅作为上游内容，不得修改 mossx access mode、MCP enable 状态、Provider 权限或文件网络权限。

#### Scenario: Catalog tool hint cannot elevate access

- **WHEN** bundled Agent source 声明 `tools` 或在 Prompt 中请求使用工具
- **THEN** runtime MUST 继续遵循当前 engine access mode 与用户确认 contract
- **AND** Catalog loader MUST NOT 自动启用 MCP、Plugin、Skill 或外部 command

#### Scenario: Opening settings has no runtime effect

- **WHEN** 用户浏览、搜索或查看 bundled Agent metadata
- **THEN**系统 MUST 不修改当前 thread selection
- **AND** MUST 不向任何 engine 发送 Prompt

### Requirement: User SHALL Be Able To Copy A Built-In Agent

Settings SHALL 允许用户将 bundled Agent 复制为 user-owned Agent。复制结果 MUST 使用现有 `agent.json` CRUD 链路，并与 bundled enable 状态和后续 Catalog 生命周期解耦。

#### Scenario: Copy creates independent custom agent

- **WHEN** 用户点击“复制到我的智能体”并确认保存
- **THEN** 系统 MUST 创建新的 user-owned Agent ID
- **AND** MUST 复制当前 localized display name 与原始 Prompt body
- **AND** 关闭或升级原 bundled Agent MUST 不删除或覆盖复制结果

#### Scenario: Agent name length supports catalog names

- **WHEN** 用户复制、创建、编辑或导入长度不超过 64 characters 的 Agent name
- **THEN** frontend 与 backend MUST 接受该名称
- **AND**现有 Prompt 100,000 characters 上限 MUST 保持不变
