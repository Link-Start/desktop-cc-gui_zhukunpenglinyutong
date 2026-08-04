## ADDED Requirements

### Requirement: skill invocations MUST travel as structured payload

选中 skill/common 发送消息时，客户端 MUST 以结构化 `skillInvocations: [{name, args?}]` 随消息下发；裸文本 `/name` 前缀 MUST 仅作降级展示且逐字保持现状。

#### Scenario: structured payload accompanies assembled text

- **WHEN** 用户选中一个或多个 skill/common 且输入非 `/` 开头文本后发送
- **THEN** `engine_send_message` IPC payload MUST 携带 `skill_invocations`，其 `name` 为去 `/`、空白转 `-` 的归一化名字
- **AND** 发送文本 MUST 与纯文本拼接结果逐字一致

#### Scenario: no invocations for raw slash input

- **WHEN** 用户输入以 `/` 开头直接发送
- **THEN** payload MUST NOT 携带 `skillInvocations`

#### Scenario: Rust boundary accepts and ignores

- **WHEN** Rust `engine_send_message` 收到 `skill_invocations`
- **THEN** 命令 MUST 正常执行且不改变引擎请求内容
- **AND** MUST 以 debug 日志记录收到数量
