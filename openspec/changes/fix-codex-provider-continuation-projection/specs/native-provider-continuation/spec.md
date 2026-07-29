## ADDED Requirements

### Requirement: Codex Continuation Target Identity MUST Match The Catalog

Codex Provider Continuation MUST 使用 `thread/start` 返回的 raw thread id 作为 runtime、
operation result、catalog metadata 与 frontend selection 的同一 authoritative identity。
Recovery MAY 读取旧 `codex:<thread-id>` operation result，但新 target MUST NOT 再写入 prefixed
result 或 duplicated stable key。

#### Scenario: Codex continuation becomes ready

- **WHEN** `thread/start` 返回 raw `<thread-id>` 且 context delivery 成功
- **THEN** operation `resultSessionId` MUST 等于 `<thread-id>`
- **AND** Provider Binding 与 Continuation metadata MUST 覆盖同一个 raw catalog row
- **AND** frontend MUST reload 并选择该 raw row

#### Scenario: legacy prefixed operation is reopened or recovered

- **WHEN** ready/recovery path 读取到既有 `resultSessionId=codex:<thread-id>`
- **THEN** runtime command MUST 继续使用 raw `<thread-id>`
- **AND** returned operation MUST 将 result 规范化为 raw `<thread-id>`
- **AND** recovery MUST NOT 创建第二个 target

### Requirement: Codex Structured Import MUST Use A Closed Control Envelope

Codex `thread/inject_items` history import MUST 在 imported items 首尾写入 exact
`MOSSX_CONTEXT_PACKAGE` 与 matching `MOSSX_CONTEXT_ACCEPTED` marker。Presentation MUST 隐藏
完整 envelope，包括其中任意 user、assistant、developer、reasoning 或 lifecycle item；envelope
关闭后的普通对话 MUST 正常显示。

#### Scenario: imported history contains user and developer items

- **WHEN** structured import payload 包含 environment、instructions 或历史 user messages
- **THEN** 所有 payload MUST 位于 matching package/accepted envelope 内
- **AND** Canvas MUST NOT 把它们渲染为普通聊天

#### Scenario: continuation imports an earlier continuation

- **WHEN** imported history 自身包含完整 package/accepted envelope
- **THEN** presentation classifier MUST 使用 identity-aware nested boundary 处理
- **AND** outer envelope 关闭前 MUST NOT 泄露 inner 或 remaining imported items

#### Scenario: imported legacy history contains an unmatched package marker

- **WHEN** outer envelope 内存在旧版本遗留的 package marker 且没有 matching accepted
- **THEN** outer matching accepted MUST 同时关闭该 imported legacy marker
- **AND** outer envelope 后的普通 user message MUST 正常显示

#### Scenario: user sends after continuation is ready

- **WHEN** matching accepted marker 已关闭 control envelope，随后用户发送普通消息
- **THEN** 普通 user message 与对应 assistant output MUST 正常显示
- **AND** filtering MUST NOT 进入 streaming reducer hot path

### Requirement: Codex Continuation Canvas MUST Hide Host Bootstrap

Canvas presentation MUST 依据 authoritative `provider-continuation` origin 与 Codex engine
隐藏 app-server 在 MossX control boundary 前后生成的 host bootstrap。该行为 MUST NOT 通过
全局 substring 删除实现，MUST NOT 改写 vendor history，并 MUST 在第一条真实 user turn 开始
后恢复普通展示。

#### Scenario: Codex injects environment context before the control prompt

- **WHEN** Codex Provider Continuation history 以 `environment_context` 开始，随后出现 exact
  MossX continuation control prompt 与 bootstrap assistant output
- **THEN** Canvas MUST 隐藏整个 leading host/control exchange
- **AND** Continuation Context Card MUST 继续作为 timeline leading metadata 展示

#### Scenario: the first real user turn arrives

- **WHEN** leading host/control exchange 后出现第一条普通 user message
- **THEN** 该 user message 与后续 assistant output MUST 正常显示
- **AND** trailing streaming cache MUST NOT 恢复已隐藏的 bootstrap item

#### Scenario: an ordinary Codex session contains similar text

- **WHEN** catalog row 不是 `provider-continuation`，或 active engine 不是 Codex
- **THEN** Messages MUST NOT 启用 leading bootstrap suppression
- **AND** 用户讨论 `environment_context` 或 MossX protocol 的普通正文 MUST 保持既有语义

### Requirement: Ready Target Selection MUST Observe Authoritative Catalog Metadata

Frontend MUST await the existing workspace catalog refresh after Provider Continuation becomes
ready and before selecting the target. It MUST NOT add polling、fixed delay、provisional Session
state or a second continuation identity registry.

#### Scenario: target history is available before catalog refresh settles

- **WHEN** runtime 已返回 ready，但 workspace catalog refresh Promise 尚未 settle
- **THEN** frontend MUST keep the current source/Dialog surface and MUST NOT select target
- **AND** target history MUST NOT enter Canvas with ordinary-session presentation

#### Scenario: catalog refresh settles with the continuation target

- **WHEN** workspace catalog refresh 已发布包含 target metadata 的 authoritative snapshot
- **THEN** frontend MUST close the Dialog and select the exact raw target id
- **AND** target Canvas 首帧 MUST 同时获得 Codex engine 与 `provider-continuation` origin
