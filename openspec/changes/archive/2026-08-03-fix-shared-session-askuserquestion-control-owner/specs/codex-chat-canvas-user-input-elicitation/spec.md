## ADDED Requirements

### Requirement: Shared Session RequestUserInput Reachability

当会话身份为 Shared Session 且 runtime 已投影完整 `sharedOwner` 时，系统 MUST 将
合法的 `item/tool/requestUserInput`（含 Claude MCP `AskUserQuestion` 与 native 路径）
送达 Shared 幕布的 pending 队列并渲染可交互卡片。系统 MUST NOT 因 Claude 事件
`params.turnId` 曾使用 assistant item id、而 `sharedOwner.runtimeTurnId` 为 attempt
runtime turn 这一历史不一致而静默丢弃事件。

投影与映射 MUST 保证 control 路径上 `params.turnId`（及兼容 `turn_id`）与
`sharedOwner.runtimeTurnId` 对齐，且 `params.threadId` 为 Shared 线程 id，
`nativeThreadId` 指向真实 Owner。卡片 item 锚定 MUST 继续使用独立的
`itemId`（如 `askuserquestion-<request_id>`），不得依赖 assistant message item id。

#### Scenario: shared Claude MCP ask surfaces interactive card

- **WHEN** Shared Session 绑定 Claude Owner 且处于 default / acceptEdits 模式
- **AND** 模型调用 in-process MCP `AskUserQuestion` 触发 `item/tool/requestUserInput`
- **AND** runtime 已为该 attempt 投影完整 `sharedOwner`（含 attemptId、runtimeTurnId、
  nativeThreadId、executionTargetSnapshot）
- **THEN** 客户端 MUST 在 Shared 幕布渲染可交互提问卡片
- **AND** 卡片 `thread_id` MUST 为 Shared thread id
- **AND** 系统 MUST NOT 仅展示转圈的 MCP 工具卡而缺少提问 UI

#### Scenario: control turn identity is aligned with shared owner runtime turn

- **WHEN** Claude 或 Shared projection 发出 `item/tool/requestUserInput`
- **AND** 该事件携带 `sharedOwner`
- **THEN** `params.turnId`（或 `turn_id`）MUST 等于 `sharedOwner.runtimeTurnId`
- **AND** 前端 `resolveSharedRuntimeControlOwner` MUST 能成功解析
- **AND** 事件 MUST NOT 因 turn 身份不一致被 fail-closed 静默丢弃

#### Scenario: incomplete shared control owner still fails closed

- **WHEN** 事件声称 Shared 身份（`threadId` 以 `shared:` 开头、或存在 sharedBridge / sharedOwner 字段）
- **AND** 缺少完整 control owner 所需字段（attemptId、providerRuntimeKey、runtimeTurnId、
  executionTargetSnapshot 或 thread/native/turn 与 binding 不一致）
- **THEN** 客户端 MUST NOT 推断 owner 并弹窗
- **AND** 客户端 MUST NOT 将卡片绑定到错误的 Shared 或 native 线程

#### Scenario: native Claude requestUserInput remains reachable

- **WHEN** 用户在 non-Shared 的 native Claude 会话触发 AskUserQuestion / requestUserInput
- **THEN** 系统 MUST 仍渲染可交互提问卡片并完成既有 answer round-trip
- **AND** Shared control owner 门禁 MUST NOT 影响无 Shared claim 的 native 事件
