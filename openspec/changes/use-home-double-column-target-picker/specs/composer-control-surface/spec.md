## ADDED Requirements

### Requirement: New Home MUST Use The Atomic CLI And Provider Target Picker

New Home Composer MUST 使用现有双栏 CLI + Provider/Model target picker 选择新会话目标。该 picker MUST 将 CLI 浏览、Provider 展开与最终 Model selection 保持在同一 focus surface；只有 Model selection SHALL 形成完整 create-session target。

#### Scenario: Home opens the double-column target picker

- **WHEN** 用户在 New Home 打开模型选择器
- **THEN** 左栏 MUST 展示当前 capability gate 允许浏览的 CLI
- **AND** 右栏 MUST 展示当前 CLI 的 Provider Profiles 与 Provider-scoped Models
- **AND** selector MUST NOT退化为仅展示当前 CLI Provider 的 Native 单栏模式

#### Scenario: Home browsing does not mutate session state

- **WHEN** 用户在 New Home 切换 CLI 或展开 Provider Profile，但尚未选择具体 Model
- **THEN** picker MUST 保持打开
- **AND** system MUST NOT 创建 thread、写入 Shared target store 或请求 Native Provider Continuation

#### Scenario: Home model selection creates one atomic draft target

- **WHEN** 用户在任一 enabled CLI/Provider 下选择具体 Model
- **THEN** system MUST 原子保存 Engine、Provider Profile、Model catalog/runtime identity 与 Reasoning selection
- **AND** picker MUST 关闭并在 Home Composer footer 展示该选择
- **AND** Home hero Engine icon MUST 与该 creation target 的 Engine 同步

#### Scenario: Unsupported discovery keeps the Provider header aligned

- **WHEN** 双栏 picker 展示不具备可信 CLI model discovery protocol 的 Claude Code
- **THEN** Provider header MUST 保留与 Codex 相同的 discovery action slot
- **AND** discovery icon MUST 置灰且不可触发 discovery
- **AND** system MUST NOT 将 config reload、HTTP 请求或静态模型列表伪装成 CLI discovery

#### Scenario: Claude local model selection settles before menu close

- **WHEN** Home 当前 target 属于 Codex，用户打开 Claude Code 的 local/disk Profile 并选择一个有效 Model
- **THEN** selector MUST 先提交包含 `engine=claude`、canonical local binding、catalog/runtime model identity 与 `providerProfileSource=disk` 的完整 target
- **AND** picker MUST 在 target owner 接收选择后关闭
- **AND** catalog refresh 或 dropdown default-close MUST NOT吞掉该次 selection

#### Scenario: Atomic catalog never projects Native current models

- **WHEN** Home 双栏展示 Claude Code local/disk 与 managed Provider Profiles
- **THEN** 每个 Profile 的 Models MUST 只来自该 `engine + providerProfileId` 的 scoped catalog
- **AND** Atomic catalog MUST NOT接收或投影 Native Session 的 `currentModels`
- **AND** Local Models MUST NOT出现在任一 managed Provider 下
- **AND** 展开 Local Profile 后用户 MUST 能选择其有效 Model

### Requirement: New Home Target MUST Initialize The Created Conversation

New Home 发送 MUST 使用当前完整 create-session target 创建新会话并发送首 Turn。创建链路 MUST NOT 依赖异步全局 Engine/Model state 更新来反推 Provider 或 Model。

#### Scenario: Home creates a conversation with the selected target

- **WHEN** 用户在 New Home 选择目标后发送首条消息
- **THEN** system MUST 使用所选 Engine 与 Provider Profile 创建新 thread
- **AND** 首 Turn MUST 使用所选 runtime Model 与 Reasoning
- **AND** 新 thread 的 Composer selection MUST 使用所选 model catalog identity 与 Reasoning

#### Scenario: Home creation target is consumed once

- **WHEN** creation orchestration 已使用 Home target 创建 thread
- **THEN** creation-only target MUST NOT 作为普通 Turn option 继续传播
- **AND** 后续 Native Session 发送 MUST 由已创建 thread 的 Engine/Provider binding 与 thread-scoped Composer selection 决定

#### Scenario: Existing selector modes remain isolated

- **WHEN** 用户打开普通 Native Session 或 Shared Session 的模型选择器
- **THEN** Native Session MUST 继续使用当前 CLI 的单栏 Provider/Model selector
- **AND** Shared Session MUST 继续使用双栏 selector 与其 durable selected target persistence
- **AND** Home create-session draft MUST NOT 改写这两种 Session 的状态
- **AND** Native 单栏 catalog owner 与 Atomic 双栏 catalog owner MUST NOT共享可变 selection/expanded state 或 `currentModels` input
