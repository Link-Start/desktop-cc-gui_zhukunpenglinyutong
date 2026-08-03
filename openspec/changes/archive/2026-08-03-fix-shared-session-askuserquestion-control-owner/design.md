## Context

Shared Session 通过 `project_app_server_event_to_shared_owner` 把 native 事件投影到
`shared:` 幕布，并附带 `sharedOwner`（attemptId / runtimeTurnId / nativeThreadId /
executionTargetSnapshot）。前端对 **control 类**事件（approval、requestUserInput、
modeBlocked）要求 `resolveSharedRuntimeControlOwner` 成功，否则 fail-closed 丢弃。

Claude `RequestUserInput` 映射历史上把 `params.turnId` 设为 **assistant item id**
（方便 turn 关联注释），而 `sharedOwner.runtimeTurnId` 是 send 时登记的 runtime turn。
投影对已有 `turnId` 使用 `or_insert` 不覆盖 → 两端不一致 → control owner 解析失败 →
提问卡不出现，MCP 仍阻塞。

Ask 卡片锚定依赖 `itemId = askuserquestion-{request_id}`，与 `turnId` 无关。

## Goals / Non-Goals

**Goals:**

- Shared Claude 路径上 `item/tool/requestUserInput` 能通过 control owner 校验并弹卡。
- 源映射与投影双层对齐 `runtime turn` 身份。
- 保留 fail-closed（无完整 owner / 跨 attempt 污染仍丢弃）。
- Native 行为不变（无 shared claim 时不走 control owner）。

**Non-Goals:**

- 重做 AskUserQuestion UI / 队列 hold 逻辑。
- 全面重构 Shared control 协议。
- Stop 与 MCP 超时的完整状态机（可后续 change）。

## Decisions

### D1: Claude 映射使用 `turn_id_context` 作为 `turnId`

- **选择**: `engine_event_to_app_server_event_with_turn_context` 中
  `RequestUserInput` 的 `turnId = turn_id_context.unwrap_or(item_id)`。
- **备选**: 继续用 assistant item id → 与 Shared owner 永不一致。
- **理由**: forwarder 已传入真实 `state.turn_id`；card 锚定靠 itemId。

### D2: Shared projection 对 control 方法强制覆盖 `turnId`

- **选择**: 当 method ∈ {`item/tool/requestUserInput`, 同类 control} 且
  `owner.runtime_turn_id` 存在时，**insert 覆盖** `turnId`/`turn_id`。
- **备选**: 仅依赖 D1 → 其它 engine/legacy 映射仍可能错位。
- **理由**: Shared control 契约以 owner.runtimeTurnId 为准；投影层兜底。

### D3: 不放宽前端 fail-closed

- **选择**: 保持 `hasSharedControlClaim && !sharedControlOwner → return`。
- **备选**: 仅有 sharedBridge 时降级用 native thread_id 弹窗 → 风险：跨 Provider /
  错误 Shared 幕布。
- **理由**: 安全优先；修复身份源即可满足门禁。

### D4: 测试策略

- Rust: 更新 `request_user_input_anchors_item_id_*` 断言 turnId；新增 projection
  control 强制覆盖测试。
- Frontend: 保留 fail-closed 测试；可补「对齐后 sharedOwner 成功弹出」payload 测试。

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| 依赖 turnId=assistant-item 的隐藏逻辑 | itemId 独立锚定；搜前端对 turn_id 的用途并回归 |
| 双修导致重复/冲突 | D1 源正确 + D2 仅 control 强制；delta/text 仍 or_insert |
| 超时/Stop 仍卡 | 本 change 不阻塞主修；手测记录，可 follow-up |

## Migration Plan

- 纯逻辑修复，无数据迁移。
- 回滚：还原 events.rs turnId 与 projection 覆盖即可。

## Open Questions

- 无（D1+D2 已收敛）。Stop/MCP 收口若手测仍现，另开 change。
