# provider-model-catalog-refresh Specification

## Purpose

定义 Provider-scoped 模型目录的配置重读、CLI discovery、分源合并和隔离契约。

## Requirements

### Requirement: Provider Catalog Actions MUST Separate Config Reload From CLI Discovery

系统 MUST 将 Provider 配置重读与 CLI model discovery 建模为两个独立动作，并按完整
`engine + providerProfileId` scope 更新模型目录。

#### Scenario: Reload config

- **WHEN** 用户对某个 Provider Profile 点击 `Reload Config`
- **THEN** 系统 MUST 重新读取该 binding 的 local/managed configuration
- **AND** MUST 只替换 configured catalog slice
- **AND** MUST NOT 发起 HTTP model request

#### Scenario: Discover models

- **WHEN** 用户对支持 model-list protocol 的 Provider Profile 点击 `Discover Models`
- **THEN** 系统 MUST 通过该 binding 对应的 CLI/runtime protocol 获取模型
- **AND** MUST 只替换 discovered catalog slice
- **AND** MUST NOT 发起 HTTP model request

#### Scenario: Unsupported CLI

- **WHEN** 目标 CLI 没有已验证的 model-list protocol
- **THEN** UI MUST 隐藏或禁用 `Discover Models`
- **AND** backend MUST NOT 解析 help text 或返回 fallback catalog 冒充 discovery

### Requirement: Provider Catalog Sources MUST Merge Without Losing User Intent

系统 MUST 合并 custom、configured、CLI-discovered、last-good 与 fallback 模型，并按
normalized runtime model identity 去重。

#### Scenario: Custom model overlaps discovery

- **WHEN** custom model 与 CLI-discovered model 指向同一 runtime model
- **THEN** custom/configured metadata MUST 获胜
- **AND** 最终模型框 MUST 只显示一个可执行选项

#### Scenario: Discovery refresh succeeds

- **WHEN** CLI discovery 返回新 catalog
- **THEN** 当前 binding 的 discovered slice MUST 被新结果替换
- **AND** custom/configured models MUST 保留

#### Scenario: Refresh fails

- **WHEN** config reload 或 CLI discovery 失败
- **THEN** 系统 MUST 保留 last-good catalog 与当前 selection
- **AND** MUST 在对应 binding 显示可诊断错误

### Requirement: Provider Catalog Requests MUST Be Binding-Isolated

Catalog cache、in-flight request、loading、error 与 stale-response guard MUST 使用完整
binding identity。

#### Scenario: Provider A resolves after Provider B

- **WHEN** Provider A 的刷新请求晚于 Provider B 返回
- **THEN** Provider A 结果 MUST 只更新 Provider A
- **AND** MUST NOT 覆盖 Provider B 当前可见模型框

#### Scenario: Duplicate action

- **WHEN** 同一 binding 的同一 action 仍在执行
- **THEN** 后续重复点击 MUST NOT 创建第二个并发请求
