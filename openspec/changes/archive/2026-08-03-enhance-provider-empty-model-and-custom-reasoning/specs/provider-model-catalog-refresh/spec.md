## ADDED Requirements

# provider-model-catalog-refresh Delta

### Requirement: Provider Catalog Cache MUST Invalidate On Provider CRUD

供应商 add / update / delete / switch / settings-json-saved / cc-switch import 后，frontend 的 Provider Profile catalog 与 Provider-scoped model catalog 模块级缓存 MUST 失效，挂载中的 Atomic picker MUST 重置本地投影并重新拉取 provider list，未挂载实例 MUST 在下次挂载读取最新数据。

#### Scenario: New provider appears without restart

- **WHEN** 用户新增一个供应商并返回对话页
- **THEN** 模型选择器 MUST 无需重启即可展示该供应商渠道
- **AND** 渠道模型列表 MUST 按该供应商配置加载

#### Scenario: Deleted provider disappears

- **WHEN** 用户删除一个供应商
- **THEN** 选择器 MUST 不再展示该渠道
- **AND** 既有 Shared target 指向已删除渠道时 MUST 保持既有 error/loading 语义，不静默回退

### Requirement: Empty Managed Model Catalog MUST Fall Back To Configured Default Model

managed provider 的 model catalog 查询成功但返回空数组时，frontend MUST 读取该供应商配置中的默认模型并合成兜底 catalog row（Claude `ANTHROPIC_MODEL`/`ANTHROPIC_DEFAULT_*`，Kimi/Grok `model`，OpenCode `models[0]`）；Codex 由 backend `configToml.model` 已覆盖，frontend 不解析 TOML。兜底 row MUST 带 `providerProfileId` 与 `source: "provider-config"`，且 MUST NOT 写入模块级共享 cache（避免污染后续真实 catalog 重试）。

#### Scenario: Provider has a configured default model

- **WHEN** 某 managed 渠道 catalog 返回空数组
- **AND** 该供应商配置包含默认模型
- **THEN** 选择器 MUST 展示该默认模型为可选项
- **AND** 后续真实 catalog 加载成功后 MUST 以真实 catalog 覆盖兜底 row

#### Scenario: Provider has no configured default model

- **WHEN** catalog 空且供应商无默认模型
- **THEN** 选择器 MUST 展示自定义模型引导文案与「添加模型」入口

### Requirement: Empty Provider Model Catalog MUST Surface Custom Model Guidance

渠道模型列表为空且非 loading / 非 error 时，模型选择器子菜单 MUST 展示引导文案，指向「自定义模型」入口，帮助用户为新增供应商补充模型。

#### Scenario: Empty channel guidance

- **WHEN** 用户展开某渠道且模型列表为空
- **THEN** 子菜单 MUST 显示两行引导（标题 + 操作提示）
- **AND** 底部「添加模型」动作 MUST 保持可用
