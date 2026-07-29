## Context

现有 Claude continuation 在 `src-tauri/src/native_continuation/commands.rs` 中创建目标 Session 后，通过普通 `send_message_with_app_settings_and_provider_env` 发送 Context Package，并要求模型精确回复 marker。该调用同时进入正常 session event pipeline；因此 bootstrap user prompt、assistant/reasoning、processing 与标题生成均可能被普通幕布消费。模型不精确回显时，command 返回 `acceptance-ambiguous`，但目标 Session 和 vendor history 可能已经存在；第二次调用通过 history probe 又恢复成功。

Shared Session 的 `TurnExecutionSnapshot` 类型已经支持 Provider name snapshot，但实际 send/projection 调用链存在 metadata 缺口或 stale target，UI 又把缺失值显示成“本地配置”，导致错误归因。

约束：

- 不能改写或删除 vendor history、来源 Session 或已创建目标 Session。
- 不能让续接 UI 改变普通 Messages DOM、scroll anchor、streaming finalization。
- 不在 AppShell 根链引入 delta/polling state。
- macOS/Windows/Linux 共用现有 app-data/history resolver。

## Goals / Non-Goals

**Goals:**

- 以 durable transport evidence 代替模型服从性作为 bootstrap 主成功依据。
- bootstrap control plane 不进入普通 conversation projection。
- continuation operation 幂等、可恢复、状态必定 terminal。
- Shared Turn identity 从发送时冻结到 reload 后显示全程一致。
- 幕布仅新增一个低侵入、默认折叠的 metadata row。

**Non-Goals:**

- 不重构 `MessagesCore`、streaming channel 或 reducer 生命周期。
- 不引入新的 event bus、数据库或第三方依赖。
- 不补做 Kimi target continuation。

## Decisions

### D1. Bootstrap acceptance 使用 durable transport evidence

Claude target Session 创建并获得稳定 target identity 后，Context Package 发送仍保留 vendor-compatible prompt transport，但 operation success 由以下 evidence 判定：

1. target Session identity 与 operation durable 绑定；
2. frozen Context Package checksum 校验通过；
3. target vendor history 中存在属于该 operation/package 的完整 bootstrap user entry，或 runtime 返回等价 accepted evidence。

精确 assistant marker 继续作为 legacy/recovery evidence，但不再是唯一 gate。history probe 必须限定 target Session、operation/package identity 与有界读取，禁止匹配普通用户文本。

替代方案：延长等待 marker。拒绝，因为模型服从性不是 transport ACK。

### D2. 不为 bootstrap 复用普通 Turn projection

bootstrap runtime event 使用独立的 `provider-continuation-*` turn owner；Frontend event
ingress 在统一入口隔离该 owner。History normalization 再按完整 protocol grammar 识别并
整体排除该 control exchange，包括关联 user、assistant、reasoning 与 lifecycle state。
普通包含 `MOSSX` 的文本不受影响。

为控制改动面，底层 runtime 可继续复用既有 send adapter；隔离发生在 continuation execution owner 与 projection boundary，不修改普通 Turn 的 reducer/streaming contract。

### D3. Operation terminal 收口由 continuation owner 负责

command 返回前必须把 operation 持久化为 `ready` 或 `recovery-required`。Frontend Dialog 不把 bootstrap runtime 的 processing event 当作目标会话普通运行状态；打开 target 后只恢复真实用户 Turn 的状态。重复 request 先 probe durable operation，不重复 create。

### D4. 幕布使用既有 Messages metadata slot

移除 Canvas 根级 continuation card。新增内容只作为 `.messages` 内的 metadata row：

- 默认折叠；
- 高度为单行，不参与 message grouping/final separator；
- 展开状态为 component-local UI state；
- 数据只来自稳定 continuation metadata，不订阅 live delta；
- 来源导航使用已有 thread navigation callback。

如果 metadata row 被关闭/隐藏，普通消息 DOM 与布局应与无 continuation 时相同。

### D5. Shared identity 在 send boundary 原子冻结

`selectedNextTarget` 只控制下一次发送。创建 `conversation.turnRequested` 时同时冻结：

- engine id 与可读 CLI display name；
- provider profile id 与 name snapshot；
- model id 与 display name；
- reasoning。

canonical projection 和 history reload 只读该 snapshot。缺失 Provider identity 的 legacy Turn 显示“历史配置未知”；只有明确的 `providerProfileId = None` local/default semantics 才显示“本地配置”。

### D6. Dialog 将错误码映射为恢复动作

Dialog 在 command 运行期如实展示“正在创建并校验”，完成后进入 ready 或
recovery-required；不伪造 backend 未提供的细粒度进度。稳定错误码保留在可折叠技术
详情；主文案说明是否已创建目标 Session、来源是否安全、下一步是重试校验还是关闭。
degraded 确认在 recovery retry 中保持。无 `window.alert/confirm`。

## Cross-layer Flow

```text
Picker selectedNextTarget
  -> sendSharedSessionTurnV2 freezes identity snapshot
  -> turnRequested canonical fact
  -> Rust persistence
  -> SharedProjector/reload
  -> MessageRow badge reads only frozen snapshot

Native continuation confirm
  -> prepare frozen artifact
  -> persist operation(prepared/creating)
  -> create target identity once
  -> deliver bootstrap with control metadata
  -> probe durable transport evidence
  -> operation(ready/recovery-required)
  -> Dialog state + compact Messages metadata row
```

## Error Matrix

| Evidence | Result | UI |
|---|---|---|
| 未创建 target，runtime unavailable | retryable failure | 可重试创建 |
| target 已创建，bootstrap entry 已持久化，marker 缺失 | `ready` | 正常打开目标 |
| target 已创建，history 暂不可读 | `recovery-required` | 重试校验，禁止重建 |
| artifact checksum 不匹配 | `recovery-required` | 阻止继续，展示技术详情 |
| operation 已 `ready` 后重复请求 | 返回同一 result | 打开既有目标 |

## Risks / Trade-offs

- [Risk] vendor history 写入完成与 command return 存在短暂竞态 → 使用小范围、有上限的 durable probe；超时进入可恢复态，不重建。
- [Risk] 旧 history 没有结构化 metadata → 兼容完整 protocol grammar，但要求 package/operation checksum 对齐，避免误过滤。
- [Risk] Shared legacy snapshot 不含 Provider name → 诚实显示未知，不猜测 profile。
- [Trade-off] metadata row 不做复杂 family tree → 遵守低侵入边界，来源关系仍可达。

## Migration Plan

1. 扩展读取逻辑兼容旧 operation/history，不改写 vendor 文件。
2. 新 operation 写入 control metadata 与完整 frozen snapshot。
3. projection 对缺失字段使用明确 legacy fallback。
4. 先跑 targeted Rust/Frontend contract tests，再启用现有 feature flow。

回滚时可恢复旧 UI/projection；新增 optional metadata 不阻断旧 reader。已创建目标 Session 和 operation 保留，不做破坏性清理。

## Open Questions

无。生产证据已足以确定 control/conversation plane 隔离与 snapshot 贯通方向。
