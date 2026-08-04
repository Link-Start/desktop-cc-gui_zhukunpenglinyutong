## ADDED Requirements

### Requirement: enhancer system prompt MUST follow UI locale

润色指令 MUST 随界面语言本地化：zh / zh-TW 使用中文指令，其余语言使用英文指令。

#### Scenario: Chinese UI sends Chinese instruction

- **WHEN** 界面语言为 zh 或 zh-TW 且用户触发 prompt enhancement
- **THEN** 发送给引擎的 system instruction MUST 为中文版本
- **AND** 指令结构（角色、要求列表、用户草稿段）与英文版一致

#### Scenario: English UI keeps English instruction

- **WHEN** 界面语言为 en（或其他非中文语言）
- **THEN** 发送的 system instruction MUST 为英文版本

### Requirement: enhancer result MUST be cached by content key

同一文本在相同引擎、模型与界面语言下的重复润色 MUST 命中缓存，MUST NOT 重复调用引擎。

#### Scenario: repeated enhancement hits cache

- **WHEN** 用户对同一文本以相同 engine + model + locale 第二次执行润色
- **THEN** 系统 MUST 直接返回首次结果
- **AND** MUST NOT 发起新的 `engineSendMessageSync` 调用

#### Scenario: failures are not cached

- **WHEN** 一次润色以超时、引擎错误或空结果失败
- **THEN** 该结果 MUST NOT 写入缓存
- **AND** 后续相同请求 MUST 重新调用引擎

### Requirement: enhancer errors MUST be structurally classified

错误分类与 fallback 重试决策 MUST 基于结构化 kind，MUST NOT 在决策点直接匹配错误文案。

#### Scenario: timeout propagates as typed kind

- **WHEN** 润色请求超出配置的超时时间
- **THEN** 系统 MUST 以 kind = timeout 的 typed error 传播
- **AND** 用户可见提示 MUST 为本地化文案并携带超时秒数

#### Scenario: retry decision reads kind only

- **WHEN** claude 引擎润色失败且错误 retryable
- **THEN** 系统 MUST 基于 kind/retryable 标志决定是否 fallback 到 codex
- **AND** 决策代码 MUST NOT 调用 `message.includes`

#### Scenario: failure copy is localized

- **WHEN** 润色失败展示错误
- **THEN** timeout / workspace / empty / generic 四类提示 MUST 使用当前界面语言
