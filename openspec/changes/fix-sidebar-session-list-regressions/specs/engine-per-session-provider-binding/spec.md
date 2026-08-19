## ADDED Requirements

### Requirement: Sidebar Provider Labels MUST Survive Reload From Session Index

系统 MUST 将 `provider_profile_id` / `provider_profile_name` 持久化在 Session Index，并在 first-paint 投影到 `ThreadSummary`。list 对缺列行 MUST 按 catalog metadata 绑定账本 overlay；Codex 无账本行 MUST 能从 `physical_path` 的 provider-home 段推断。前端投影 MUST 拷贝这两列，不得在 Index → summary 时丢弃。

「在会话列表显示供应商标签」开关 MUST 渲染在 CLI 配置管理内容区顶部，对所有 CLI 页可见，MUST NOT 只出现在 Codex 详情页。

#### Scenario: provider label survives client reload

- **GIVEN** 用户以 managed provider 创建 Codex / Claude / Grok native 会话
- **WHEN** 客户端重启并完成 Session Index first paint
- **THEN** 该会话行 MUST 携带 `providerProfileId` / `providerProfileName`
- **AND** 开关开启时侧栏 MUST 显示对应供应商标签
- **AND** MUST NOT 依赖 full catalog 之后标签才出现

#### Scenario: legacy index rows self-heal via overlay

- **GIVEN** 升级前写入的 Index 行没有 provider 列值
- **AND** catalog metadata 存在该会话的绑定账本
- **WHEN** list Session Index
- **THEN** 返回行 MUST overlay 账本中的 provider id / name
- **AND** metadata 缺失或损坏时 MUST 静默降级为无标签，list MUST NOT 报错

#### Scenario: provider label toggle is global

- **WHEN** 用户打开任意已启用 CLI 的配置页
- **THEN** 内容区顶部 MUST 提供「在会话列表显示供应商标签」开关
- **AND** Codex 引擎设置卡 MUST NOT 再重复该开关

### Requirement: Selecting A Historical Thread MUST Restore Its Provider Binding

选中一条历史 native 会话时，系统 MUST 把该会话已持久化的 `providerProfileId` / `providerProfileName` 设为 composer 当前 execution target。用户未新选供应商时，随后 send 的请求参数 MUST 使用该会话 binding，MUST NOT 使用「上次全局选中」的 provider 覆盖账本。

后端解析优先级保持：send 参数 > catalog 绑定账本 > default。前端 MUST 保证「未改选」时 send 参数与会话 binding 一致，从而使账本生效。

#### Scenario: switching history restores independent provider

- **GIVEN** 会话 A 绑定 managed provider A，会话 B 绑定 managed provider B
- **WHEN** 用户从 A 点到 B
- **THEN** composer MUST 显示 provider B
- **AND** 下一次 send 的 `providerProfileId` MUST 为 B
- **AND** MUST NOT 把 A 的 home / 配置写入 B 的进程
- **AND** 点击路径 MUST NOT 调用 `vendor_switch_*` / `activateEngineProviderProfile`
- **AND** MUST NOT 在切会话时调用 `refreshEngineModels` / `get_engine_models`

#### Scenario: all native engines can show a provider label

- **GIVEN** Claude / Codex / Grok / Kimi / OpenCode / PI / DSH / Gemini 会话带有 `providerProfileId`
- **WHEN** 开关开启且侧栏渲染
- **THEN** 系统 MUST 显示供应商标签（本地 sentinel 显示 `local`，managed 显示名称）
- **AND** 无 provider 列且 overlay 也找不到的老数据 MAY 不显示标签

#### Scenario: missing summary provider falls back to ledger without global picker

- **GIVEN** ThreadSummary 暂时没有 provider 字段
- **AND** catalog 绑定账本有该 thread 的 managed binding
- **WHEN** 用户选中该会话并发送且未改 picker
- **THEN** 生效供应商 MUST 为账本 binding
- **AND** MUST NOT 因 picker 仍停在上一会话而改绑
