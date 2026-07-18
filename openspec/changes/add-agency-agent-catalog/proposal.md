## Why

当前智能体管理只覆盖用户自建或导入的 `~/.ccgui/agent.json`，缺少可发现、可分组、可本地化且受用户显式启用控制的内置智能体资产。`agency-agents` 已提供 248 个角色 Prompt 与 17 个领域分组，适合以固定版本 Catalog 形式内置，为用户提供可理解、可选择、仅在 `#` 引用后生效的智能体能力。

## 目标与边界

- 将固定 revision 的 `agency-agents` 资产标准化为可插拔的 bundled Agent Catalog。
- 在 `智能体/提示词 -> 智能体` 中明确区分“我的智能体”和“内置智能体”，并展示完整分组、数量、中文名称与中文描述。
- 由 Settings 中的显式 enable 状态控制内置智能体是否进入 Composer `#` 选择器。
- 保证 `Enabled != Active`：enable 只控制可发现性，只有用户通过 `#` 选中并形成可见 Agent Chip 时才允许注入 Prompt。
- 保持现有自定义智能体行为与 `~/.ccgui/agent.json` 数据兼容。

## What Changes

- 新增可插拔 `AgentCatalogProvider` contract 与第一个 `Agency Agents` bundled provider。
- 内置固定 revision 的 248 个智能体、17 个分组、MIT attribution、source path、content hash 与双语 metadata。
- 新增 `AppSettings.enabledBuiltInAgentIds`，默认空集合，作为跨 workspace 的内置智能体 Enable Registry。
- 智能体设置页新增“我的智能体 / 内置智能体”视图、分组导航、搜索、启用状态、分组批量启停、详情查看及“复制到我的智能体”入口。
- Composer `#` provider 合并自定义智能体与已启用内置智能体；未启用项不得出现在空态、分组列表或搜索结果中。
- 发送链路增加 fail-closed activation validation：内置智能体未启用、已失效或 Prompt 读取失败时不得注入。
- i18n UI copy 使用现有 i18next；Catalog metadata 提供 `en` 与 `zh-CN`，非中文 locale fallback 到 English。
- 将智能体名称上限从 20 调整到 64，以覆盖内置 Catalog 的合法名称及复制场景。

## 非目标

- 不根据用户输入自动路由或自动启用智能体。
- 不将 248 个内置智能体批量写入 `~/.ccgui/agent.json`。
- 不执行 `agency-agents` 仓库的 `install.sh`、`convert.sh` 或其他脚本。
- 不自动授予 `tools`、MCP、文件、网络或 Provider 权限。
- 不把 Playbook 转换为可执行多智能体 Workflow。
- 不创建 Claude/Codex Provider-native agent projection。
- 不翻译或改写原始执行 Prompt body，避免角色约束发生语义漂移。
- MVP 不支持多个智能体同时 Active。

## 方案对比与取舍

### 方案 A：全部导入自定义智能体存储

实现最简单，但会污染 `agent.json`、失去 bundled/user-owned 边界、无法安全升级与撤销，也会让 `#` 默认暴露全部 248 个智能体。拒绝采用。

### 方案 B：Bundled Catalog + 独立 Enable Registry（采用）

Catalog 作为只读、版本化资源；Settings 控制 discoverability，Composer 只消费 enabled metadata，选中时再读取 Prompt body。该方案复用现有 AppSettings 与 Agent Chip 链路，同时保持 Catalog 可插拔和运行时 fail-closed。

### 方案 C：运行时 GitHub 拉取或 Git submodule

可获得独立更新节奏，但引入网络可用性、供应链漂移、release reproducibility 与离线不可用问题。MVP 不采用，未来可在同一 Provider contract 下增加 signed remote catalog。

## Capabilities

### New Capabilities

- `curated-agent-catalog`: 定义 bundled Agent Catalog、分组与本地化展示、显式 enable、Composer `#` discoverability、显式 activation、Prompt lazy loading、复制为自定义智能体和安全边界。

### Modified Capabilities

- `settings-navigation-consolidation`: 扩展现有“智能体”tab，使其承载“我的智能体 / 内置智能体”二级资产管理视图，同时保持原自定义智能体 CRUD 行为。

## Impact

- Backend：`AppSettings` schema、settings normalization/persistence、bundled resource loader、Tauri command registry。
- Frontend：Agent domain types、Tauri bridge、Settings agent feature、Composer `#` provider、selected-agent session validation、发送链路。
- Resources：固定 revision 的 Agency Agents metadata/Prompt、division definition、`zh-CN` localization 与 attribution。
- i18n：现有 10 个 locale 的 UI keys；Catalog 内容只增加 `en` / `zh-CN` 双语 metadata。
- Packaging：Tauri resources 增加 Catalog 资产，但不增加运行时网络依赖或新的第三方 package。

## 验收标准

- Catalog 完整性检查满足：17 个分组、248 个唯一智能体、0 个未分组项、0 个重复 stable ID、248/248 中文名称与描述覆盖。
- 默认 `enabledBuiltInAgentIds = []`，Settings 可浏览全部内置智能体，但 Composer `#` 不显示任何内置智能体。
- 单个或分组启用后，对应项无需重启即可进入 `#`；关闭后立即从 `#` 消失。
- 内置智能体仅在用户通过 `#` 选中并显示 Agent Chip 时注入 Prompt；enable 但未选中不得注入。
- 已 Active 的内置智能体被关闭、ID 失效或 body 读取失败时，下一次发送不得注入其 Prompt，并向用户提供可理解的状态。
- 中文 locale 显示中文名称、中文描述和中文分组；其他 locale 在 Catalog metadata 缺失时稳定 fallback 到 English。
- 自定义智能体 CRUD、导入导出、Composer 选择和已有会话行为不回退。
- Catalog metadata 不进入 AppShell 高频更新链，Prompt body 不在 Settings 列表或 `#` 初始打开时批量传输。
